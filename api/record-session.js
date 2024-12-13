// api/record-session.js
import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  // POST以外を拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // リクエストからデータ取得
  const { timestamp, duration, mode, task } = req.body;

  // 必要な変数が揃っているか簡易チェック
  if (!timestamp || typeof duration !== 'number' || !mode || !task) {
    return res.status(400).json({ error: "Missing or invalid parameters" });
  }

  // Notionクライアント初期化
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!databaseId) {
    return res.status(500).json({ error: "Notion Database ID not configured" });
  }

  // 終了時刻(timestamp)を基点に開始時刻を計算
  // timestampはISO文字列と想定 (例: "2024-12-15T09:25:00.000Z")
  const endTime = new Date(timestamp);
  // durationは分単位, 開始時刻 = 終了時刻 - duration分
  const startTime = new Date(endTime.getTime() - duration * 60000);
  const startIso = startTime.toISOString();
  const endIso = endTime.toISOString();

  // プロパティを定義
  // Name: `${mode}: ${task} (${duration}min)`
  // Session Time: start ~ end
  // Mode: select (mode)
  // Duration: number (duration)
  // Task: rich_text (task)
  const properties = {
    "Name": {
      "title": [
        { "text": { "content": `${mode}: ${task} (${duration}min)` } }
      ]
    },
    "Session Time": {
      "date": {
        "start": startIso,
        "end": endIso
      }
    },
    "Mode": {
      "select": { "name": mode }
    },
    "Duration": {
      "number": duration
    },
    "Task": {
      "rich_text": [
        { "text": { "content": task } }
      ]
    }
    // Duration HoursはNotion側でFormulaを設定するため、コード上では不要
    // Notesが必要なら以下を追加:
    // "Notes": {
    //   "rich_text": [
    //     { "text": { "content": "Additional notes here." } }
    //   ]
    // }
  };

  try {
    // Notionページ作成
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties
    });

    // 成功応答
    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error('Notion API error:', error);
    res.status(500).json({ error: "Failed to write to Notion" });
  }
}
