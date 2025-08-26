import { NextResponse } from "next/server";
import { parseString } from "whatsapp-chat-parser";
import AdmZip from "adm-zip";

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

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    // Find the first .txt file inside the ZIP
    const txtEntry = zipEntries.find((entry) =>
      entry.entryName.endsWith(".txt")
    );
    if (!txtEntry) {
      console.log("No .txt file found in ZIP");
      return NextResponse.json(
        { error: "No .txt file found in ZIP" },
        { status: 400 }
      );
    }

    const chatText = txtEntry.getData().toString("utf8");

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
        // Permit regex (PTW/LOA/SFT + number) or just "/"
        const permitRegex = new RegExp(
          `\\b(${keywords.join("|")})\\b[\\s:\\-#\\/]*(\\d+)?`,
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

        // Issued To / Issued By regex
        const issuedToRegex = /issued to\s*[:\-]?\s*(.+?)(?:\n|$)/i;
        const issuedByRegex = /issued by\s*[:\-]?\s*(.+?)(?:\n|$)/i;

        let issuedToMatch = cleanMessage.match(issuedToRegex);
        let issuedByMatch = cleanMessage.match(issuedByRegex);

        let issuedTo = issuedToMatch
          ? issuedToMatch[1].trim()
          : issuedByMatch
          ? msg.author
          : ""; // if issuedTo missing but issuedBy exists, default to sender

        const issuedBy = issuedByMatch
          ? issuedByMatch[1].trim()
          : issuedToMatch
          ? msg.author
          : ""; // if issuedBy missing but issuedTo exists, default to sender

        //  if both are missing assign sender to issued to
        if (!issuedBy && !issuedTo) {
          issuedTo = msg.author;
        }

        // Remarks regex
        const remarkRegex = new RegExp(
          `\\b(remark|remarks|note|notes|edit)\\b[\\s:\\-#\\/]*(\\d+)?`,
          "i"
        );
        const remarkMatch = cleanMessage.match(remarkRegex);
        const remarkNumber = remarkMatch ? remarkMatch[2] || "" : "";



        const messageDate =
          msg.date instanceof Date ? msg.date : new Date(msg.date);

        return {
          date: messageDate.toISOString().split("T")[0], // YYYY-MM-DD
          time: messageDate.toISOString().split("T")[1].split(".")[0], // HH:MM:SS
          sender: msg.author,
          msg: cleanMessage,
          SS: stationNumber,
          PermitType: keyword,
          PermitNumber: permitNumber ? permitNumber : "",
          issuedBy,
          issuedTo,
          remark: remarkNumber ? remarkNumber : "",
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

/**
 * if the message contines the flowoing  remark, edit, notes, note or remarks its should be folowed by permit details eg.LOA 123 add the number to the remark coulmn
 *  if there is no issued by or issued to  the sender should be assigned to both
 *
 */
