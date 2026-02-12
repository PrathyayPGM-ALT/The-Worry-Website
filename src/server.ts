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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const harmfulPatterns = {
  profanity: [
    /\b(stupid|fuck|dumb|idiot|moron|loser|jerk|fool)\b/gi,
    /\b(suck|sucks|sucked|sucking)\b/gi,
    /\b(freak|weirdo|psycho|crazy|lame)\b/gi,
    /\b(ugly|fat|skinny|gross|disgusting)\b/gi,
    /\b(hate\s*(you|u)|hate\s+your)\b/gi,
    /\b(stfu|stink|smelly|eww+)\b/gi,
    /\b(wtf|wth|omfg|lmfao|af|asf|stfu|gtfo|ffs|bs|fu)\b/gi,
    /\b(a+ss|a+hole|b+tch|d+mn|d+ck|sh+t|f+ck|cr+p|h+ll)\b/gi,
    /\b(st[0o]pid|dum+b|id[i1]ot|l[o0]ser)\b/gi,
  ],
  silencing: [
    /\b(shut\s*(up|it|your\s*(mouth|face|trap)))\b/gi,
    /\b(be\s+quiet|zip\s+it|nobody\s+asked)\b/gi,
    /\b(go\s+away|leave\s+(me\s+)?alone|get\s+(out|lost|away))\b/gi,
    /\b(don'?t\s+care|who\s+cares|no\s*one\s+cares?)\b/gi,
    /\b(stop\s+(talking|posting|crying|whining))\b/gi,
  ],
  bullying: [
    /\b(nobody\s*(likes?|loves?|wants?)\s*(you|u))\b/gi,
    /\b(you('re|\s+are)\s+(pathetic|worthless|useless|terrible|awful|annoying|boring))\b/gi,
    /\b(cry\s*baby|baby|wimp|coward|chicken)\b/gi,
    /\b(your\s+fault|blame\s+(you|u))\b/gi,
    /\b(you\s+(deserve|asked\s+for)\s+(it|this))\b/gi,
    /\b(loser|failure|waste\s+of)\b/gi,
  ],
  sarcasm: [
    /\b(oh\s+wow|yeah\s+right|sure\s+buddy|whatever|big\s+deal)\b/gi,
    /\b(boo\s*hoo|poor\s+(you|baby)|so\s+sad|cry\s+more)\b/gi,
    /\b(like\s+(I|anyone)\s+cares?|as\s+if)\b/gi,
    /\b(lol|lmao|haha|rofl)\s*(loser|stupid|dumb|idiot)/gi,
    /\b(good\s+for\s+you|wow\s+so\s+(cool|brave|special))\b/gi,
    /🙄|😒|💅|🤡/g,
  ],
  dismissive: [
    /\b(get\s+over\s+it|move\s+on|just\s+stop|deal\s+with\s+it)\b/gi,
    /\b(not\s+(a\s+)?(big\s+)?deal|doesn'?t\s+matter)\b/gi,
    /\b(you('re|\s+are)\s+overreacting|too\s+sensitive)\b/gi,
    /\b(drama\s*queen|attention\s*(seek|want))/gi,
    /\b(grow\s+up|act\s+your\s+age|be\s+mature)\b/gi,
  ],
  harmful: [
    /\b(kill|hurt|harm|cut|bleed|amputate)\s*(your)?self\b/gi,
    /\b(you\s+should(n't)?\s+(exist|die|disappear|leave))\b/gi,
    /\b(end\s+it|give\s+up|kys)\b/gi,
    /\b(world.*(better|without)\s*(you|u))\b/gi,
  ],
};

const supportivePatterns = [
  /\b(sorry|understand|here\s+for\s+you|support|help|care|love)\b/gi,
  /\b(you('re|\s+are)\s+(not\s+alone|brave|strong|amazing|loved))\b/gi,
  /\b(it('ll|\s+will)\s+(be|get)\s+(okay|better))\b/gi,
  /\b(sending\s+(hugs?|love)|virtual\s+hug)\b/gi,
  /❤️|💙|💚|💜|🤗|😊|💪|🫂/g,
];

interface ModerationResult {
  isAllowed: boolean;
  reason?: string;
  category?: string;
  confidence: number;
}

function moderateContent(content: string): ModerationResult {
  let supportScore = 0;
  for (const pattern of supportivePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      supportScore += matches.length * 2;
    }
  }

  let harmScore = 0;
  let detectedCategory = '';
  let detectedReason = '';

  for (const [category, patterns] of Object.entries(harmfulPatterns)) {
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        const severity = category === 'harmful' ? 10 : category === 'bullying' ? 5 : 3;
        harmScore += matches.length * severity;

        if (!detectedCategory || severity > (detectedCategory === 'harmful' ? 10 : 3)) {
          detectedCategory = category;
          detectedReason = `Detected ${category} language: "${matches[0]}"`;
        }
      }
    }
  }

  const finalScore = harmScore - supportScore;

  if (harmScore >= 3) {
    return {
      isAllowed: false,
      reason: detectedReason || 'Let\'s keep this space kind and supportive! 💙',
      category: detectedCategory,
      confidence: Math.min(harmScore / 10, 1),
    };
  }

  return {
    isAllowed: true,
    confidence: 1 - (finalScore / 20),
  };
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

  const moderation = moderateContent(content);
  if (!moderation.isAllowed) {
    return res.status(400).json({
      error: 'moderation',
      message: moderation.reason,
      category: moderation.category,
    });
  }

  const nicknameCheck = moderateContent(nickname || '');
  if (!nicknameCheck.isAllowed) {
    return res.status(400).json({
      error: 'moderation',
      message: 'Please choose a kinder nickname',
    });
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

  const moderation = moderateContent(content);
  if (!moderation.isAllowed) {
    return res.status(400).json({
      error: 'moderation',
      message: moderation.reason,
      category: moderation.category,
    });
  }

  const nicknameCheck = moderateContent(nickname || '');
  if (!nicknameCheck.isAllowed) {
    return res.status(400).json({
      error: 'moderation',
      message: 'Please choose a kinder nickname',
    });
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

const GROQ_API_KEY = process.env.GROQ_API_KEY;

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

app.post('/api/moderate', (req, res) => {
  const { content } = req.body;
  const result = moderateContent(content || '');
  res.json(result);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`The Worry Website is running at http://localhost:${PORT}`);
  console.log(`AI Content Moderation is ACTIVE`);
});
