"use client";

import { useState } from "react";
import IonIcon from "../../components/IonIcon";
import { adminService } from "../../services/adminService";

export default function PostsPage() {
  const [testLink, setTestLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!testLink) return;
    try {
      setLoading(true);
      await adminService.addTestLink(testLink);
      alert("Test link added successfully!");
      setTestLink('');
    } catch (err) {
      alert("Failed to add test link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Posts Management</h1>
        <p className="text-slate-400">Manage user posts and add test content.</p>
      </div>

      <div className="bg-[#09090b] border border-[#1a1a1a] rounded-xl p-8 max-w-xl">
        <h3 className="text-lg font-bold text-white mb-4">Add Test Link</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Link URL</label>
            <input 
              type="url" 
              value={testLink}
              onChange={(e) => setTestLink(e.target.value)}
              placeholder="https://example.com/test-content"
              className="w-full bg-black border border-[#1a1a1a] rounded-lg px-4 py-2.5 text-white focus:border-white/50 outline-none"
            />
          </div>
          <button className="bg-white hover:bg-gray-200 text-black font-bold py-3 px-6 rounded-xl transition-all w-full">
            Add Test Link
          </button>
        </div>
      </div>
    </div>
  );
}
