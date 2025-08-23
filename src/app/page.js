"use client";
import { useState } from "react";
import { mkConfig, generateCsv, download } from "export-to-csv";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const fileInput = e.currentTarget.elements.namedItem("file");
    const startDateInput = e.currentTarget.elements.namedItem("startDate");
    const file = fileInput.files?.[0];
    const startDate = startDateInput.value; // get selected start date
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("startDate", startDate); // send startDate to backend

    setLoading(true);

    try {
      const res = await fetch("/api/parse-whatsapp", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to parse file");

      const data = await res.json();

      // If backend does not filter, you can filter here:
      const filtered = data.filter((msg) => {
        return new Date(msg.date) >= new Date(startDate);
      });

      console.log("Filtered messages count:", filtered.length);
      setMessages(filtered);

      if (filtered.length === 0) {
        setError("No messages found for the selected date");
      } else {
        setError(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred");
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
    <div className="flex justify-center items-center h-svh" >
      <div className="container mt-3 max-w-lg p-6 border rounded-xl shadow-xl bg-white font-sans">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Upload WhatsApp file (.zip format)
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700">Start Date </span>
            <input
              type="date"
              name="startDate"
              required
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
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

          {messages.length == 0 && !loading && (
            <p className="text-center text-red-500">{error}</p>
          )}
        </form>

        {messages.length > 0 && (
          <ul className="space-y-4 max-h-[500px] overflow-y-auto">
            <div className="flex flex-col justify-center p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
              <div className="flex justify-between items-center ">
                <p>Results:</p>
                <p>
                  Total Number of Records: <b>{messages.length} </b>
                </p>
              </div>
              <button
                onClick={handleDownloadCSV}
                className=" mt-5 mx-auto w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Export as CSV
              </button>
            </div>
            {/* {messages.map((msg, i) => (
            <li
              key={i}
              className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col shadow-sm"
            >
              <span className="font-semibold text-blue-700 text-lg text-right">
                {msg.sender}
              </span>
              <span className="text-xs text-gray-500 mb-2 text-right">
                {msg.date} - {msg.time}
              </span>
              <span className="text-gray-800 whitespace-pre-wrap">
                {msg.text}
              </span>
              <span className="mt-2 inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Permit: {msg.permits}
              </span>
              <span className="mt-2 inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Permit Number: {msg.permitNumber}
              </span>
              <span className="mt-2 inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Station Number: {msg.stationNumber}
              </span>
            </li>
          ))} */}
          </ul>
        )}
      </div>
    </div>
  );
}
