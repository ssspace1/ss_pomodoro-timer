import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({error:"Method Not Allowed"});
  }

  const { timestamp, duration, mode, task } = req.body;

  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;

  if(!notion || !databaseId){
    return res.status(500).json({error:"Notion integration not configured"});
  }

  try {
    // Pythonコードに合わせて、Name, Date, Descriptionを使う形に変更
    // タイトル: Name(title)
    // 日付: Date(date)
    // 説明: Description(rich_text)
    // DurationやTypeを使いたい場合は後でプロパティ追加
    const properties = {
      "Name": {
        "title": [
          { "type": "text", "text": { "content": task || "Untitled" } }
        ]
      },
      "Date": { "date": { "start": timestamp } },
      "Description": {
        "rich_text": [
          { "type": "text", "text": { "content": `Mode: ${mode}, Duration: ${duration}min` } }
        ]
      }
    };

    await notion.pages.create({
      parent: { database_id: databaseId },
      properties
    });

    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error('Notion API error:', error);
    console.log("Received data:", req.body);
    res.status(500).json({error: "Failed to write to Notion"});
  }
}
