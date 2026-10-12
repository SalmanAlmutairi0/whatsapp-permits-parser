"use client";
import { useState } from "react";
import Image from "next/image";
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
    if (!file) {
      console.warn("[whatsapp-parser] Upload skipped: no file selected");
      return;
    }

    console.info("[whatsapp-parser] Upload started", {
      bytes: file.size,
      dateFilterApplied: Boolean(startDate),
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("startDate", startDate); // send startDate to backend

    setLoading(true);

    try {
      const res = await fetch("/api/parse-whatsapp", {
        method: "POST",
        body: formData,
      });
      console.info("[whatsapp-parser] Parse response received", {
        status: res.status,
      });

      if (!res.ok) throw new Error("Failed to parse file");

      const data = await res.json();
      console.info("[whatsapp-parser] Parse results loaded", {
        messageCount: data.length,
      });

      // If backend does not filter, you can filter here:
      const filtered = data.filter((msg) => {
        return new Date(msg.date) >= new Date(startDate);
      });

      console.info("[whatsapp-parser] Date filtering completed", {
        receivedMessageCount: data.length,
        filteredMessageCount: filtered.length,
      });
      setMessages(filtered);

      if (filtered.length === 0) {
        console.warn("[whatsapp-parser] No messages found for the selected date");
        setError("No messages found for the selected date");
      } else {
        setError(null);
      }
    } catch (err) {
      console.error("[whatsapp-parser] Upload failed", err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
      console.info("[whatsapp-parser] Upload processing finished");
    }
  }

  const handleDownloadCSV = () => {
    if (!messages.length) {
      console.warn("[whatsapp-parser] CSV export skipped: no messages");
      return;
    }

    console.info("[whatsapp-parser] CSV export started", {
      recordCount: messages.length,
    });

    const csvConfig = mkConfig({
      useKeysAsHeaders: true,
      filename: "work_permits",
    });

    const csv = generateCsv(csvConfig)(messages);
    download(csvConfig)(csv);
    console.info("[whatsapp-parser] CSV download triggered", {
      recordCount: messages.length,
    });
  };

  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4 py-6">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="page-heading">
        <div className="mb-6 flex items-center gap-4 border-b border-slate-100 pb-5">
          <Image src="/saudi-energy-logo.svg" alt="Saudi Energy" width={60} height={50} priority />
          <span className="border-l border-slate-200 pl-4 text-lg font-semibold text-[#001f5e]">Work permits</span>
        </div>

        <h1 id="page-heading" className="text-2xl font-semibold tracking-tight text-[#001f5e]">WhatsApp permit parser</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-500">Upload a chat ZIP and export your permit records.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={loading}>
          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-medium text-[#001f5e]">Start date &amp; time</span>
            <input
              type="datetime-local"
              name="startDate"
              required
              className="min-h-12 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-medium text-[#001f5e]">WhatsApp export (.zip)</span>
            <input
              type="file"
              name="file"
              accept=".zip"
              required
              className="min-h-12 w-full min-w-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-base text-slate-600 outline-none file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#0066cc] focus:border-[#0066cc] focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-lg bg-[#0066cc] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#0055aa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066cc] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Parsing…" : "Parse chat"}
          </button>

          {messages.length === 0 && !loading && error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">{error}</p>
          )}
        </form>

        {messages.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-5" aria-live="polite">
            <p className="mb-4 text-center text-sm text-slate-600"><strong className="text-[#001f5e]">{messages.length}</strong> permit records found</p>
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="min-h-12 w-full rounded-lg border border-[#0066cc] bg-blue-50 px-4 py-3 text-base font-medium text-[#0066cc] transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066cc]"
            >
              Export CSV
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
