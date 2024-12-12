import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({error:"Method Not Allowed"});
  }

  const { timestamp, duration, mode, task } = req.body;

  // 環境変数から取得（Vercelで設定）
  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if(!notionToken || !databaseId){
    return res.status(500).json({error:"Notion integration not configured"});
  }

  const notion = new Client({ auth: notionToken });
  
  try {
    const properties = {
      "Date": { date: { start: timestamp } },
      "Duration": { number: duration },
      "Type": { select: { name: mode } }
    };

    if (task && task.trim() !== "") {
      // Taskはtitleプロパティ（Notion DBで"Task"がtitleの列想定）
      properties["Task"] = {
        title: [{ type: "text", text: { content: task } }]
      };
    }

    await notion.pages.create({
      parent: { database_id: databaseId },
      properties
    });

    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error('Notion API error:', error);
    res.status(500).json({error: "Failed to write to Notion"});
  }
}
