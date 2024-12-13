// api/record-session.js
import { Client } from "@notionhq/client"; // Notion公式のNode.js用パッケージを使う

export default async function handler(req, res) {
  // リクエストがPOST（データを送る形）以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // リクエストからデータを取り出す
  const { timestamp, duration, mode, task } = req.body;
  // たとえば、timestampは終わった時間、durationは何分作業したか、modeは"Work"とか、taskはタスク名。

  // Notionクライアントを作る
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!databaseId) {
    return res.status(500).json({ error: "Notion Database ID not set" });
  }

  try {
    // Notionに書き込むデータを定義
    // "Name"や"Date"、"Description"は、あなたのNotionデータベースのカラム名に合わせて調整
    // 下記は一例です（Title, Date, Textカラムがある前提）
    const properties = {
      "Name": {
        "title": [
          { "text": { "content": task || "No Task Name" } }
        ]
      },
      "Date": {
        "date": { "start": timestamp }
      },
      "Description": {
        "rich_text": [
          { "text": { "content": `Mode: ${mode}, Duration: ${duration}min` } }
        ]
      }
    };

    // Notionへページを作成（= データベースに行を追加）
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties
    });

    // 成功レスポンスを返す
    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error('Notion API error:', error);
    res.status(500).json({ error: "Failed to write to Notion" });
  }
}
