import { NextResponse } from "next/server";
import { parseString } from "whatsapp-chat-parser";

export const config = {
  api: {
    bodyParser: false, // important for file streaming
  },
};

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const startDateStr = formData.get("startDate"); // get start date from form

    if (!file || typeof file.text !== "function") {
      console.log("No file or not a valid File object");
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const chatText = await file.text();

    const messages = await parseString(chatText, {
      returnMessagesWithParsedDates: true,
      includeSystemMessages: false,
      parseAttachments: false,
    });

    const keywords = ["PTW", "LOA", "SFT"];

    const filteredMessages = messages
      .filter((msg) => msg.author && msg.message)
      .map((msg) => {
        const cleanMessage = msg.message.replace(/[\u200E\u202F]/g, "");

        // Permit regex (PTW/LOA/SFT + number)
        const permitRegex = new RegExp(
          `\\b(${keywords.join("|")})\\b[\\s:\\-#]*(\\d+)?`,
          "i"
        );
        const permitMatch = cleanMessage.match(permitRegex);

        if (!permitMatch) return null;

        const keyword = permitMatch[1];
        const permitNumber = permitMatch[2] || "";

        // Station regex (SS 123, S/S 123, المحطة 123)
        const stationRegex =
          /\b(?:SS|S\/S|المحطة|المحطه|بالمحطة|بالمحطه)\s*(\d+)/i;
        const stationMatch = cleanMessage.match(stationRegex);
        const stationNumber = stationMatch ? stationMatch[1] : "";

        const messageDate =
          msg.date instanceof Date ? msg.date : new Date(msg.date);

        return {
          sender: msg.author,
          permits: keyword,
          permitNumber: permitNumber ? permitNumber : "",
          stationNumber,
          text: cleanMessage,
          date: messageDate.toISOString().split("T")[0], // YYYY-MM-DD
          time: messageDate.toISOString().split("T")[1].split(".")[0], // HH:MM:SS
        };
      })
      .filter(Boolean)
      // Filter by start date if provided
      .filter((msg) => {
        if (!startDateStr) return true;
        const startDate = new Date(startDateStr);
        return new Date(msg.date) >= startDate;
      });

    console.log("Filtered messages count:", filteredMessages.length);
    return NextResponse.json(filteredMessages);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
