"use client";
import { useState } from "react";
import { mkConfig, generateCsv, download } from "export-to-csv";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const fileInput = e.currentTarget.elements.namedItem("file");
    const file = fileInput.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    try {
      const res = await fetch("/api/parse-whatsapp", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to parse file");

      const data = await res.json();
      console.log("Received messages count:", data);
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleDownloadCSV = () => {
    if (!messages.length) return;

    const csvConfig = mkConfig({
      useKeysAsHeaders: true,
      filename: "work_permits",
    });

    const csv = generateCsv(csvConfig)(messages);
    download(csvConfig)(csv);
  };

  return (
    <div className="container mx-auto mt-14 max-w-xl p-6 border rounded-xl shadow-xl bg-white font-sans">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        ارفع الملف
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
        <input
          type="file"
          name="file"
          accept=".txt"
          required
          className="border border-gray-300 rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white w-full py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          {loading ? "Parsing..." : "Upload"}
        </button>
      </form>

      {messages.length > 0 && (
        <ul className="space-y-4 max-h-[500px] overflow-y-auto">
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
            <button
              onClick={handleDownloadCSV}
              className="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Export as CSV
            </button>
            <div className="flex justify-between items-center mt-4">
              <p>Preview:</p>
              <p>
                Total Number of Records: <b>{messages.length} </b>
              </p>
            </div>
          </div>
          {messages.map((msg, i) => (
            <li
              key={i}
              className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col shadow-sm"
            >
              <span className="font-semibold text-blue-700 text-lg">
                {msg.sender}
              </span>
              <span className="text-xs text-gray-500 mb-2">
                {msg.date} - {msg.time}
              </span>
              <span className="text-gray-800 whitespace-pre-wrap">
                {msg.text}
              </span>
              <span className="mt-2 inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {msg.permits}
              </span>
              <span className="mt-2 inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {msg.permitNumber}
              </span>
              <span className="mt-2 inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {msg.stationNumber}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
