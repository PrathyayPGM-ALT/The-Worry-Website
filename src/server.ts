import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

interface ModerationResult {
  isAllowed: boolean;
  reason?: string;
  category?: string;
  confidence: number;
}

const MODERATION_PROMPT = `You are a content moderator for "The Worry Website" — a safe, anonymous peer-support platform for kids and teens (ages 8-16). Your job is to decide if a message is safe to post.

BLOCK messages that contain:
- Profanity, slurs, or vulgar language (including obfuscated variants like "f*ck", "sh1t", "st0pid")
- Bullying, insults, or name-calling (e.g. "you're pathetic", "nobody likes you", "loser")
- Silencing or dismissive language (e.g. "shut up", "nobody cares", "get over it", "drama queen")
- Sarcasm or mockery aimed at someone's feelings (e.g. "boo hoo", "cry more", "yeah right")
- Self-harm encouragement or threats (e.g. "kys", "you should die", "hurt yourself")
- Hate speech, racism, sexism, homophobia, or any discriminatory language
- Sexual content or inappropriate references for minors
- Personal information (real names, addresses, phone numbers, social media handles)
- Spam, gibberish, or off-topic trolling

ALLOW messages that:
- Express genuine feelings (sadness, anger, fear, anxiety, embarrassment, disgust)
- Ask for help or support
- Offer kind, supportive, or empathetic responses
- Share personal worries or experiences appropriately
- Use the word "stupid" or "crazy" to describe a SITUATION (not a person) — e.g. "this situation is crazy" is OK, "you're crazy" is NOT

Respond with ONLY valid JSON (no markdown, no extra text):
{"allowed": true/false, "reason": "brief explanation", "category": "none|profanity|bullying|silencing|sarcasm|dismissive|harmful|sexual|personal_info|spam", "confidence": 0.0-1.0}`;

async function moderateContent(content: string): Promise<ModerationResult> {
  if (!content || content.trim().length === 0) {
    return { isAllowed: true, confidence: 1 };
  }

  if (!GROQ_API_KEY) {
    console.warn('No GROQ_API_KEY set — allowing content without AI moderation');
    return { isAllowed: true, confidence: 0.5 };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: MODERATION_PROMPT },
          { role: 'user', content: `Moderate this message:\n\n"${content}"` },
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.error('Moderation API error:', await response.text());
      return { isAllowed: true, confidence: 0.5 };
    }

    const data = await response.json() as any;
    const aiResponse = data.choices?.[0]?.message?.content?.trim();

    if (!aiResponse) {
      return { isAllowed: true, confidence: 0.5 };
    }

    const parsed = JSON.parse(aiResponse);

    return {
      isAllowed: parsed.allowed === true,
      reason: parsed.allowed ? undefined : (parsed.reason || "Let's keep this space kind and supportive!"),
      category: parsed.category !== 'none' ? parsed.category : undefined,
      confidence: parsed.confidence || 0.8,
    };
  } catch (error) {
    console.error('AI moderation error:', error);
    return { isAllowed: true, confidence: 0.5 };
  }
}

const validForums = ['anger', 'fear', 'sadness', 'anxiety', 'disgust', 'embarrassment'];

app.get('/api/posts/:forum', async (req, res) => {
  const { forum } = req.params;

  if (!validForums.includes(forum)) {
    return res.status(400).json({ error: 'Invalid forum' });
  }

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('forum', forum)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('posts')
      .select('*')
      .eq('forum', forum)
      .order('created_at', { ascending: false });

    if (fallbackError) {
      return res.status(500).json({ error: fallbackError.message });
    }
    return res.json(fallbackData);
  }

  res.json(data);
});

app.post('/api/posts', async (req, res) => {
  const { forum, content, nickname } = req.body;

  if (!validForums.includes(forum)) {
    return res.status(400).json({ error: 'Invalid forum' });
  }

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const moderation = await moderateContent(content);
  if (!moderation.isAllowed) {
    return res.status(400).json({
      error: 'moderation',
      message: moderation.reason,
      category: moderation.category,
    });
  }

  if (nickname && nickname.trim()) {
    const nicknameCheck = await moderateContent(nickname);
    if (!nicknameCheck.isAllowed) {
      return res.status(400).json({
        error: 'moderation',
        message: 'Please choose a kinder nickname',
      });
    }
  }

  const { data, error } = await supabase
    .from('posts')
    .insert([{
      forum,
      content: content.trim(),
      nickname: nickname?.trim() || 'Anonymous',
      is_deleted: false,
    }])
    .select()
    .single();

  if (error) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('posts')
      .insert([{
        forum,
        content: content.trim(),
        nickname: nickname?.trim() || 'Anonymous',
      }])
      .select()
      .single();

    if (fallbackError) {
      return res.status(500).json({ error: fallbackError.message });
    }
    return res.status(201).json(fallbackData);
  }

  res.status(201).json(data);
});

app.get('/api/posts/:forum/:id', async (req, res) => {
  const { id } = req.params;

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (postError) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.is_deleted) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const { data: replies, error: repliesError } = await supabase
    .from('replies')
    .select('*')
    .eq('post_id', id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (repliesError) {
    const { data: fallbackReplies } = await supabase
      .from('replies')
      .select('*')
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    return res.json({ post, replies: fallbackReplies || [] });
  }

  res.json({ post, replies });
});

app.post('/api/replies', async (req, res) => {
  const { post_id, content, nickname, is_trusted } = req.body;

  if (!post_id) {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const moderation = await moderateContent(content);
  if (!moderation.isAllowed) {
    return res.status(400).json({
      error: 'moderation',
      message: moderation.reason,
      category: moderation.category,
    });
  }

  if (nickname && nickname.trim()) {
    const nicknameCheck = await moderateContent(nickname);
    if (!nicknameCheck.isAllowed) {
      return res.status(400).json({
        error: 'moderation',
        message: 'Please choose a kinder nickname',
      });
    }
  }

  const { data, error } = await supabase
    .from('replies')
    .insert([{
      post_id,
      content: content.trim(),
      nickname: nickname?.trim() || 'Helper',
      is_deleted: false,
      is_trusted: is_trusted || false,
    }])
    .select()
    .single();

  if (error) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('replies')
      .insert([{
        post_id,
        content: content.trim(),
        nickname: nickname?.trim() || 'Helper',
      }])
      .select()
      .single();

    if (fallbackError) {
      return res.status(500).json({ error: fallbackError.message });
    }
    return res.status(201).json(fallbackData);
  }

  res.status(201).json(data);
});

app.delete('/api/posts/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('posts')
    .update({ is_deleted: true })
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  await supabase
    .from('replies')
    .update({ is_deleted: true })
    .eq('post_id', id);

  res.json({ success: true });
});

app.delete('/api/replies/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('replies')
    .update({ is_deleted: true })
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

const AI_SYSTEM_PROMPT = `You are a kind, warm, and supportive AI helper on "The Worry Website" — a safe space for kids and teens to share their worries anonymously.

Your role:
- You are talking to a young person who is worried, scared, sad, angry, embarrassed, or anxious
- Be genuinely empathetic, warm, and age-appropriate (ages 8-16)
- Validate their feelings first — never dismiss or minimize what they're going through
- Offer gentle, practical coping strategies when appropriate
- Use simple, friendly language — like a caring older sibling or school counselor
- Keep responses concise (2-4 short paragraphs max)
- Encourage them to talk to a trusted adult (parent, teacher, counselor) if the worry is serious
- NEVER diagnose, prescribe, or give medical/legal advice
- NEVER be dismissive, sarcastic, or use harsh language
- If they mention self-harm, abuse, or danger, gently encourage them to reach out to a trusted adult or helpline

Remember: You're here to make them feel heard, less alone, and a little bit better.`;

app.post('/api/ai-reply', async (req, res) => {
  const { content, forum } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI helper is not configured' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: `I'm in the "${forum}" section of The Worry Website. Here's what's on my mind:\n\n${content}` },
        ],
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Groq API error:', errorData);
      return res.status(500).json({ error: 'AI helper is temporarily unavailable' });
    }

    const data = await response.json() as any;
    const aiReply = data.choices?.[0]?.message?.content;

    if (!aiReply) {
      return res.status(500).json({ error: 'AI helper could not generate a response' });
    }

    res.json({ reply: aiReply });
  } catch (error) {
    console.error('AI helper error:', error);
    res.status(500).json({ error: 'Could not reach AI helper. Please try again.' });
  }
});

app.post('/api/moderate', async (req, res) => {
  const { content } = req.body;
  const result = await moderateContent(content || '');
  res.json(result);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`The Worry Website is running at http://localhost:${PORT}`);
  console.log(`AI Content Moderation is ACTIVE`);
});
