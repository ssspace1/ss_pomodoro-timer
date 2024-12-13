import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({error:"Method Not Allowed"});
  }

  const { timestamp, duration, mode, task } = req.body;

  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;

  // timestampは終了時刻、ここから開始時刻を計算
  const endTime = new Date(timestamp);
  const startTime = new Date(endTime.getTime() - duration * 60000);
  const startIso = startTime.toISOString();
  const endIso = endTime.toISOString();

  // プロパティ名を上記で決めたとおりに設定
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
    // "Duration Hours"はNotion上でFormulaを設定するためコードには不要
    // Notesを使うなら下記のように追加できます:
    // "Notes": {
    //   "rich_text": [
    //     { "text": { "content": "Any additional note" } }
    //   ]
    // }
  };

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties
    });

    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error('Notion API error:', error);
    res.status(500).json({error:"Failed to write to Notion"});
  }
}
