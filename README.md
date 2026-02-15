# The Worry Website

A safe, anonymous space for kids to share their worries and support each other. Inspired by Inside Out emotions.

<img src="https://skillicons.dev/icons?i=nodejs" width="55" /> &nbsp;&nbsp;
<img src="https://skillicons.dev/icons?i=typescript" width="55" /> &nbsp;&nbsp;
<img src="https://skillicons.dev/icons?i=javascript" width="55" /> &nbsp;&nbsp;
<img src="https://skillicons.dev/icons?i=css" width="55" /> &nbsp;&nbsp;
<img src="https://skillicons.dev/icons?i=html" width="55" /> &nbsp;&nbsp;

## Features

- **6 Emotion-Based Forums** - Anger, Fear, Sadness, Anxiety, Disgust, and Embarrassment
- **Anonymous Posting** - Share feelings without revealing identity
- **Supportive Replies** - Community members can offer support
- **AI Content Moderation** - Automatically filters mean, sarcastic, or harmful content
- **Kid-Friendly Design** - Colorful themes inspired by Inside Out characters

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Frontend**: Vanilla JavaScript, CSS3
- **Moderation**: Pattern-based content filtering

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account

### Database Setup

1. Create a new Supabase project
2. Run this SQL in the Supabase SQL Editor:

```sql
-- Create posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  forum VARCHAR(50) NOT NULL CHECK (forum IN ('anger', 'fear', 'sadness', 'anxiety', 'disgust', 'embarrassment')),
  content TEXT NOT NULL,
  nickname VARCHAR(50) DEFAULT 'Anonymous',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create replies table
CREATE TABLE replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  nickname VARCHAR(50) DEFAULT 'Helper',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access
CREATE POLICY "Allow public read" ON posts FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON posts FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON replies FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON replies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON replies FOR UPDATE USING (true);
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/the-worry-website.git
cd the-worry-website
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Add your Supabase credentials to `.env`:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Start the development server:
```bash
npm run dev
```

6. Open http://localhost:3000

## Project Structure

```
the-worry-website/
├── public/
│   ├── css/
│   │   └── styles.css      # All styles with emotion themes
│   ├── js/
│   │   └── app.js          # Client-side SPA router
│   ├── images/             # Inside Out character images
│   └── index.html          # Entry point
├── src/
│   └── server.ts           # Express server + API + moderation
├── package.json
├── tsconfig.json
└── README.md
```

## Deployment

### Render (Recommended)

1. Push to GitHub
2. Connect repo at [render.com](https://render.com)
3. Add environment variables
4. Deploy

### Railway

1. Connect repo at [railway.app](https://railway.app)
2. Add environment variables
3. Deploy

### Heroku

```bash
heroku create your-app-name
heroku config:set SUPABASE_URL=... SUPABASE_ANON_KEY=...
git push heroku main
```

## Content Moderation

The app includes pattern-based moderation that filters:
- Profanity and mean words
- Bullying language
- Sarcasm and mocking
- Dismissive comments
- Harmful suggestions

Supportive language is detected and can offset minor issues to reduce false positives.

## License

MIT License - feel free to use this for your own projects!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
