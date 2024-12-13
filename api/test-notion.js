// api/test-notion.js
import { Client } from '@notionhq/client';

export default async function handler(req, res) {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Name": {
          "title": [{ "text": { "content": "Vercelテストタスク" } }]
        },
        "Date": { "date": { "start": "2024-12-16T11:00:00" } },
        "Description": {
          "rich_text": [{ "text": { "content": "Vercel上でのテスト記録" } }]
        }
      }
    });
    res.status(200).json({ message:"Success", response });
  } catch (error) {
    console.error('Notion API error:', error);
    res.status(500).json({ error:error.message });
  }
}
