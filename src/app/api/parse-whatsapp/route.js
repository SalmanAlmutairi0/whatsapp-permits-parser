import { NextResponse } from "next/server";
import { parseString } from "whatsapp-chat-parser";
import AdmZip from "adm-zip";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  console.info("[parse-whatsapp] Request received");

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const startDateStr = formData.get("startDate");

    if (!file || typeof file.text !== "function") {
      console.warn("[parse-whatsapp] Upload rejected: missing or invalid file", {
        status: 400,
      });
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    console.info("[parse-whatsapp] Upload read", {
      bytes: buffer.length,
      dateFilterApplied: Boolean(startDateStr),
    });
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    console.info("[parse-whatsapp] ZIP opened", {
      entryCount: zipEntries.length,
    });

    // Find the first .txt file inside the ZIP
    const txtEntry = zipEntries.find((entry) =>
      entry.entryName.endsWith(".txt"),
    );
    if (!txtEntry) {
      console.warn("[parse-whatsapp] Upload rejected: no .txt file in ZIP", {
        status: 400,
      });
      return NextResponse.json(
        { error: "No .txt file found in ZIP" },
        { status: 400 },
      );
    }

    const chatText = txtEntry.getData().toString("utf8");
    console.info("[parse-whatsapp] Chat text extracted", {
      characterCount: chatText.length,
    });

    const messages = await parseString(chatText, {
      returnMessagesWithParsedDates: true,
      includeSystemMessages: false,
      parseAttachments: false,
    });
    console.info("[parse-whatsapp] Chat parsed", {
      messageCount: messages.length,
    });

    const keywords = ["PTW", "LOA", "SFT"];

    const filteredMessages = messages
      .filter((msg) => msg.author && msg.message)
      .map((msg) => {
        const cleanMessage = msg.message.replace(/[\u200E\u202F]/g, "");

        // Permit regex (PTW/LOA/SFT + number)
        // Permit regex (PTW/LOA/SFT + number) or just "/"
        const permitRegex = new RegExp(
          `(${keywords.join("|")})[\\s:\\-#\\/]*(\\d+)?`,
          "i",
        );

        const permitMatch = cleanMessage.match(permitRegex);

        if (!permitMatch) return null;

        const keyword = permitMatch[1];
        const permitNumber = permitMatch[2] || "";

        // Station regex (SS 123, S/S 123, المحطة 123)
        const stationRegex =
          /(?:SS|S\/S|المحطة|المحطه|بالمحطة|بالمحطه)\s*([\d٠-٩]+)/i;
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

        let issuedBy = issuedByMatch
          ? issuedByMatch[1].trim()
          : issuedToMatch
            ? msg.author
            : ""; // if issuedBy missing but issuedTo exists, default to sender

        //  if both are missing assign sender to issued to
        if (!issuedBy && !issuedTo) {
          issuedTo = msg.author;
          issuedBy = msg.author;
        }

        // Remark regex (remark:, remarks:, edit/, note:)
        const remarkRegex =
          /\b(remark|remarks|edit|note|notes)\b[\s:\/\-#]*(.+)/i;

        let remarkNumber = "";
        const remarkMatch = cleanMessage.match(remarkRegex);

        if (remarkMatch) {
          const remarkText = remarkMatch[2].trim(); // text after remark:

          // Only extract number after PTW/LOA/SFT
          const numberMatch = remarkText.match(
            /\b(?:PTW|LOA|SFT)[\s:\-/#]*(\d+)/i,
          );

          if (numberMatch) {
            remarkNumber = numberMatch[1];
          }
        }

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

    console.info("[parse-whatsapp] Request completed", {
      parsedMessageCount: messages.length,
      filteredMessageCount: filteredMessages.length,
      status: 200,
    });
    return NextResponse.json(filteredMessages);
  } catch (e) {
    console.error("[parse-whatsapp] Request failed", { status: 500 }, e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
