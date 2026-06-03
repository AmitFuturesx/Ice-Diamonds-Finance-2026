import React, { useState } from 'react';
import { Delivery } from '../types';
import { Plus, Trash2, Edit2, Check, X, Truck, Landmark, Scale } from 'lucide-react';

interface DeliveriesViewProps {
  deliveries: Delivery[];
  activeMonthId: string;
  onSaveDelivery: (delivery: Omit<Delivery, 'id'> & { id?: string }) => Promise<void>;
  onDeleteDelivery: (id: string) => Promise<void>;
}

export default function DeliveriesView({
  deliveries,
  activeMonthId,
  onSaveDelivery,
  onDeleteDelivery
}: DeliveriesViewProps) {
  // New delivery state
  const [newDate, setNewDate] = useState('');
  const [newRouteFrom, setNewRouteFrom] = useState('');
  const [newRouteTo, setNewRouteTo] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editRouteFrom, setEditRouteFrom] = useState('');
  const [editRouteTo, setEditRouteTo] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteFrom || !newRouteTo || !newPrice) return;

    const dateToSave = newDate || new Date().toISOString().split('T')[0];

    await onSaveDelivery({
      month_id: activeMonthId,
      date: dateToSave,
      route_from: newRouteFrom,
      route_to: newRouteTo,
      price: Number(newPrice) || 0,
      notes: newNotes
    });

    setNewDate('');
    setNewRouteFrom('');
    setNewRouteTo('');
    setNewPrice('');
    setNewNotes('');
  };

  const startEdit = (del: Delivery) => {
    setEditingId(del.id);
    setEditDate(del.date);
    setEditRouteFrom(del.route_from);
    setEditRouteTo(del.route_to);
    setEditPrice(String(del.price));
    setEditNotes(del.notes);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    await onSaveDelivery({
      id,
      month_id: activeMonthId,
      date: editDate,
      route_from: editRouteFrom,
      route_to: editRouteTo,
      price: Number(editPrice) || 0,
      notes: editNotes
    });
    setEditingId(null);
  };

  // Calculations
  const runningTotalNet = deliveries.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  const vatRate = 0.17; // 17% Israeli VAT
  const vatAmount = runningTotalNet * vatRate;
  const runningTotalGross = runningTotalNet + vatAmount;

  return (
    <div className="space-y-6">
      
      {/* VAT Summary Header panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 space-y-1">
          <h2 className="text-xl font-bold text-white">ריכוז שליחויות והפצה</h2>
          <p className="text-xs text-zinc-500">
            מעקב אחר משולחי חבילות מבוטחות ללקוחות קצה, ספקים וסדנאות יציקה
          </p>
          <div className="pt-2 text-xs text-amber-500 font-semibold flex items-center gap-1.5 font-sans">
            <Scale className="w-4.5 h-4.5 text-[#22c55e]" />
            <span>הערה: המחירים רשומים ללא מע״מ כחוק. מע״מ נוכחי: 17%</span>
          </div>
        </div>

        <div className="p-6 bg-zinc-900/30 border-t md:border-t-0 md:border-r border-zinc-800 text-center flex flex-col justify-center">
          <span className="text-xs text-zinc-500 block">סה״כ שליחויות נטו (ללא מע״מ)</span>
          <span className="text-2xl font-black font-mono text-zinc-350 mt-1">
            {runningTotalNet.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
          </span>
        </div>

        <div className="p-6 bg-zinc-900/50 border-t md:border-t-0 md:border-r border-zinc-800 text-center flex flex-col justify-center">
          <span className="text-xs text-zinc-500 block">סה״כ לתשלום כולל מע״מ (17%)</span>
          <span className="text-2xl font-black font-mono text-[#22c55e] mt-1">
            {runningTotalGross.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
          </span>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-900/10">
              <th className="p-4 font-semibold w-1/6">תאריך</th>
              <th className="p-4 font-semibold w-1/3">מסלול (מוצא ← יעד)</th>
              <th className="p-4 font-semibold w-1/6">מחיר נטו (₪)</th>
              <th className="p-4 font-semibold w-1/4">הערות ופירוט</th>
              <th className="p-4 font-bold text-center w-[15%]">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-zinc-600">
                  אין שליחויות רשומות לחודש הנבחר.
                </td>
              </tr>
            ) : (
              deliveries.map((item) => {
                const isEditing = editingId === item.id;

                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-zinc-900/35 transition-colors duration-200 ${
                      isEditing ? 'bg-zinc-900/60' : ''
                    }`}
                  >
                    {/* Date */}
                    <td className="p-4 font-mono text-zinc-400">
                      {isEditing ? (
                        <input
                          id={`edit-del-date-${item.id}`}
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none font-mono focus:border-green-500"
                        />
                      ) : (
                        <span>{item.date}</span>
                      )}
                    </td>

                    {/* Route */}
                    <td className="p-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            id={`edit-del-from-${item.id}`}
                            type="text"
                            value={editRouteFrom}
                            onChange={(e) => setEditRouteFrom(e.target.value)}
                            placeholder="מוצא"
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white max-w-[120px] outline-none focus:border-green-500"
                          />
                          <span className="text-zinc-500">←</span>
                          <input
                            id={`edit-del-to-${item.id}`}
                            type="text"
                            value={editRouteTo}
                            onChange={(e) => setEditRouteTo(e.target.value)}
                            placeholder="יעד"
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white max-w-[120px] outline-none focus:border-green-500"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-white flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <span>{item.route_from}</span>
                          <span className="text-zinc-600">←</span>
                          <span>{item.route_to}</span>
                        </span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="p-4 font-mono text-xs font-semibold text-zinc-200">
                      {isEditing ? (
                        <input
                          id={`edit-del-price-${item.id}`}
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm text-white w-24 outline-none font-mono focus:border-green-500"
                        />
                      ) : (
                        <span>{Number(item.price).toLocaleString()} ₪</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="p-4 text-zinc-400">
                      {isEditing ? (
                        <input
                          id={`edit-del-notes-${item.id}`}
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="הערות..."
                          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white w-full outline-none focus:border-green-500"
                        />
                      ) : (
                        <span>{item.notes || '—'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              id={`save-del-${item.id}`}
                              onClick={() => handleSaveEdit(item.id)}
                              className="p-1.5 hover:bg-green-950/40 text-green-400 rounded transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              id={`cancel-del-${item.id}`}
                              onClick={cancelEdit}
                              className="p-1.5 hover:bg-zinc-800 text-zinc-400 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              id={`edit-del-${item.id}`}
                              onClick={() => startEdit(item)}
                              className="p-1.5 hover:bg-zinc-800 hover:text-[#22c55e] text-zinc-500 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              id={`delete-del-${item.id}`}
                              onClick={() => onDeleteDelivery(item.id)}
                              className="p-1.5 hover:bg-red-950/40 hover:text-red-400 text-zinc-500 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add New Delivery Form Box */}
      <div className="bg-[#121212] border border-zinc-800 p-6 rounded-2xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#22c55e]" />
          רישום שליחות חדשה
        </h3>

        <form onSubmit={handleAddNew} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">תאריך המשלוח *</label>
            <input
              id="new-del-date"
              type="date"
              required
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">עיר מוצא *</label>
            <input
              id="new-del-from"
              type="text"
              required
              value={newRouteFrom}
              onChange={(e) => setNewRouteFrom(e.target.value)}
              placeholder="לדוג׳ רמת גן"
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">עיר יעד *</label>
            <input
              id="new-del-to"
              type="text"
              required
              value={newRouteTo}
              onChange={(e) => setNewRouteTo(e.target.value)}
              placeholder="לדוג׳ תל אביב, ירושלים"
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium font-sans">מחיר נטו ללא מע״מ (₪) *</label>
            <input
              id="new-del-price"
              type="number"
              required
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-green-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-zinc-400 font-medium">הערות מיוחדות</label>
              <input
                id="new-del-notes"
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="לדוג׳ שביר, מבוטח..."
                className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500"
              />
            </div>
            
            <button
              id="add-del-btn"
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-black font-bold h-[42px] px-4 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer text-sm shrink-0 shadow-lg shadow-green-500/10"
              title="רשום שליחות"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
