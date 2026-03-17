"use client";

import IonIcon from "../../components/IonIcon";

export default function VerificationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Verification</h1>
        <p className="text-slate-400">Review and approve user ID verifications.</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">ID Type</th>
              <th className="px-6 py-4">Document</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="px-6 py-4">
                <p className="font-bold">Alice Johnson</p>
                <p className="text-xs text-slate-500">alice@example.com</p>
              </td>
              <td className="px-6 py-4">Passport</td>
              <td className="px-6 py-4 text-blue-400 cursor-pointer hover:underline">view_document.pdf</td>
              <td className="px-6 py-4"><span className="text-amber-400 bg-amber-400/10 px-2 py-1 rounded text-[10px] font-bold">PENDING</span></td>
              <td className="px-6 py-4 text-right space-x-2">
                <button className="text-emerald-400 p-2 hover:bg-emerald-400/10 rounded"><IonIcon name="checkmark-circle-outline" /></button>
                <button className="text-rose-400 p-2 hover:bg-rose-400/10 rounded"><IonIcon name="close-circle-outline" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
