"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { AlertTriangle, Plus, Trash2, Pencil, Check } from "lucide-react";
import type { ReceiptData, ReceiptItem } from "~/server/contracts/receipt";
import type { GroupMember } from "~/server/contracts/groups";

interface ItemizedSplitProps {
  receiptData: ReceiptData;
  groupMembers: GroupMember[];
  /** Called whenever assignments change with the computed per-person totals */
  onSplitsChange: (splits: { recipientId: string; amount: number }[]) => void;
  /** Called when items are edited so the parent can update totals */
  onReceiptDataChange?: (updated: ReceiptData) => void;
}

/** Map of itemIndex → Set of memberIds who claimed the item */
type Assignments = Map<number, Set<string>>;

export default function ItemizedSplit({
  receiptData,
  groupMembers,
  onSplitsChange,
  onReceiptDataChange,
}: ItemizedSplitProps) {
  const [items, setItems] = useState<ReceiptItem[]>(() => receiptData.items.map((i) => ({ ...i })));
  const [assignments, setAssignments] = useState<Assignments>(() => new Map());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Detect mismatch between computed item subtotal and the receipt's reported subtotal
  const itemsSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotalMismatch = Math.abs(itemsSubtotal - receiptData.subtotal) > 0.01;

  const buildLocalReceiptData = useCallback(
    (currentItems: ReceiptItem[]): ReceiptData => {
      const newSubtotal = currentItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return { ...receiptData, items: currentItems, subtotal: newSubtotal };
    },
    [receiptData],
  );

  const localReceiptData = useMemo(
    () => buildLocalReceiptData(items),
    [buildLocalReceiptData, items],
  );

  // Notify parent of receipt data + split changes (deferred to avoid setState-during-render)
  const notifyParent = useCallback(
    (currentItems: ReceiptItem[], currentAssignments: Assignments) => {
      const data = buildLocalReceiptData(currentItems);
      onReceiptDataChange?.(data);
      const splits = computeSplits(data, groupMembers, currentAssignments);
      onSplitsChange(splits);
    },
    [buildLocalReceiptData, groupMembers, onSplitsChange, onReceiptDataChange],
  );

  const updateItem = useCallback(
    (index: number, update: Partial<ReceiptItem>) => {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index]!, ...update };
        queueMicrotask(() => notifyParent(next, assignments));
        return next;
      });
    },
    [assignments, notifyParent],
  );

  const removeItem = useCallback(
    (index: number) => {
      setItems((prev) => {
        const next = prev.filter((_, i) => i !== index);
        setAssignments((prevA) => {
          const nextA = new Map<number, Set<string>>();
          for (const [key, value] of prevA) {
            if (key < index) nextA.set(key, value);
            else if (key > index) nextA.set(key - 1, value);
          }
          queueMicrotask(() => notifyParent(next, nextA));
          return nextA;
        });
        return next;
      });
      if (editingIndex === index) setEditingIndex(null);
    },
    [editingIndex, notifyParent],
  );

  const addItem = useCallback(() => {
    setItems((prev) => {
      const next = [...prev, { name: "New item", price: 0, quantity: 1 }];
      queueMicrotask(() => notifyParent(next, assignments));
      return next;
    });
    setEditingIndex(items.length);
  }, [items.length, assignments, notifyParent]);

  const toggleAssignment = useCallback(
    (itemIndex: number, memberId: string) => {
      setAssignments((prev) => {
        const next = new Map(prev);
        const current = next.get(itemIndex) ?? new Set();
        const updated = new Set(current);
        if (updated.has(memberId)) {
          updated.delete(memberId);
        } else {
          updated.add(memberId);
        }
        if (updated.size === 0) {
          next.delete(itemIndex);
        } else {
          next.set(itemIndex, updated);
        }

        const splits = computeSplits(localReceiptData, groupMembers, next);
        onSplitsChange(splits);

        return next;
      });
    },
    [localReceiptData, groupMembers, onSplitsChange],
  );

  const assignAllToMember = useCallback(
    (memberId: string) => {
      setAssignments((prev) => {
        const hasAll = items.every((_, i) => prev.get(i)?.has(memberId));
        const next = new Map(prev);

        items.forEach((_, i) => {
          const current = next.get(i) ?? new Set();
          const updated = new Set(current);
          if (hasAll) {
            updated.delete(memberId);
          } else {
            updated.add(memberId);
          }
          if (updated.size === 0) {
            next.delete(i);
          } else {
            next.set(i, updated);
          }
        });

        const splits = computeSplits(localReceiptData, groupMembers, next);
        onSplitsChange(splits);
        return next;
      });
    },
    [items, localReceiptData, groupMembers, onSplitsChange],
  );

  const { perPersonBreakdown, unclaimedItems, unclaimedTotal } = useMemo(
    () => computeBreakdown(localReceiptData, groupMembers, assignments),
    [localReceiptData, groupMembers, assignments],
  );

  return (
    <div className="space-y-4">
      {/* Mismatch warning */}
      {subtotalMismatch && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-medium">Parsing mismatch detected.</span> Items total $
            {itemsSubtotal.toFixed(2)} but receipt subtotal is ${receiptData.subtotal.toFixed(2)}.
            Please review and adjust items below.
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Receipt Items</span>
          <div className="flex items-center gap-2">
            {receiptData.merchantName && (
              <span className="text-muted-foreground text-xs">{receiptData.merchantName}</span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="h-auto px-2 py-0.5 text-xs"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Item
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          {items.map((item, itemIndex) => {
            const itemAssignees = assignments.get(itemIndex) ?? new Set();
            const isUnclaimed = itemAssignees.size === 0;
            const itemTotal = item.price * item.quantity;
            const isEditing = editingIndex === itemIndex;

            return (
              <div
                key={itemIndex}
                className={cn(
                  "border-border rounded-lg border p-2.5 transition-colors",
                  isUnclaimed ? "border-dashed border-yellow-300 bg-yellow-50/50" : "bg-muted/30",
                )}
              >
                {isEditing ? (
                  <div className="mb-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(itemIndex, { name: e.target.value })}
                        className="h-7 text-sm"
                        placeholder="Item name"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setEditingIndex(null)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-muted-foreground mb-0.5 block text-[10px]">
                          Price
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) =>
                            updateItem(itemIndex, { price: parseFloat(e.target.value) || 0 })
                          }
                          className="h-7 text-sm"
                        />
                      </div>
                      <div className="w-16">
                        <label className="text-muted-foreground mb-0.5 block text-[10px]">
                          Qty
                        </label>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(itemIndex, {
                              quantity: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="h-7 text-sm"
                        />
                      </div>
                      <div className="flex shrink-0 items-end pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          onClick={() => removeItem(itemIndex)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">
                        {item.name}
                        {item.quantity > 1 && (
                          <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                        )}
                      </span>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                      <span className="text-sm font-medium">${itemTotal.toFixed(2)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground h-6 w-6"
                        onClick={() => setEditingIndex(itemIndex)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Member assignment chips */}
                <div className="flex flex-wrap gap-1">
                  {groupMembers.map((member) => {
                    const isAssigned = itemAssignees.has(member.id);
                    return (
                      <Button
                        key={member.id}
                        type="button"
                        variant="outline"
                        onClick={() => toggleAssignment(itemIndex, member.id)}
                        className={cn(
                          "flex h-auto items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                          isAssigned
                            ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                            : "",
                        )}
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[7px]">
                            {member.firstName.charAt(0)}
                            {member.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {member.firstName}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick assign: click a member to assign all items */}
      <div className="space-y-1.5">
        <span className="text-muted-foreground text-xs font-medium">Quick assign all items</span>
        <div className="flex flex-wrap gap-1.5">
          {groupMembers.map((member) => {
            const hasAll = items.every((_, i) => assignments.get(i)?.has(member.id));
            return (
              <Button
                key={member.id}
                type="button"
                variant="outline"
                onClick={() => assignAllToMember(member.id)}
                className={cn(
                  "flex h-auto items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                  hasAll ? "border-primary bg-primary/10 text-primary hover:bg-primary/20" : "",
                )}
              >
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[7px]">
                    {member.firstName.charAt(0)}
                    {member.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {member.firstName}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Unclaimed warning */}
      {unclaimedItems > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-2.5 text-sm text-yellow-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {unclaimedItems} unclaimed {unclaimedItems === 1 ? "item" : "items"} ($
            {unclaimedTotal.toFixed(2)})
          </span>
        </div>
      )}

      {/* Receipt totals */}
      <div className="border-border space-y-1 rounded-lg border p-3 text-sm">
        <div className="text-muted-foreground flex justify-between">
          <span>Items Subtotal</span>
          <span className={cn(subtotalMismatch && "font-medium text-amber-600")}>
            ${itemsSubtotal.toFixed(2)}
          </span>
        </div>
        {localReceiptData.tax > 0 && (
          <div className="text-muted-foreground flex justify-between">
            <span>Tax</span>
            <span>${localReceiptData.tax.toFixed(2)}</span>
          </div>
        )}
        {localReceiptData.tip > 0 && (
          <div className="text-muted-foreground flex justify-between">
            <span>Tip</span>
            <span>${localReceiptData.tip.toFixed(2)}</span>
          </div>
        )}
        <div className="border-border flex justify-between border-t pt-1 font-medium">
          <span>Total</span>
          <span>${(itemsSubtotal + localReceiptData.tax + localReceiptData.tip).toFixed(2)}</span>
        </div>
      </div>

      {/* Per-person breakdown */}
      {perPersonBreakdown.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Per Person Breakdown</span>
          <div className="space-y-1.5">
            {perPersonBreakdown.map(({ member, itemsTotal, taxShare, tipShare, total }) => (
              <div
                key={member.id}
                className="border-border bg-muted/30 flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[9px]">
                      {member.firstName.charAt(0)}
                      {member.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-sm font-medium">{member.firstName}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      ${itemsTotal.toFixed(2)}
                      {taxShare > 0 && ` + $${taxShare.toFixed(2)} tax`}
                      {tipShare > 0 && ` + $${tipShare.toFixed(2)} tip`}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold">${total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compute per-person splits with proportional tax/tip */
function computeSplits(
  receiptData: ReceiptData,
  groupMembers: GroupMember[],
  assignments: Assignments,
): { recipientId: string; amount: number }[] {
  const memberTotals = new Map<string, number>();

  // Sum each member's claimed item totals
  receiptData.items.forEach((item, itemIndex) => {
    const assignees = assignments.get(itemIndex);
    if (!assignees || assignees.size === 0) return;

    const itemTotal = item.price * item.quantity;
    const perPerson = itemTotal / assignees.size;

    assignees.forEach((memberId) => {
      memberTotals.set(memberId, (memberTotals.get(memberId) ?? 0) + perPerson);
    });
  });

  // Distribute tax and tip proportionally
  const allClaimedTotal = Array.from(memberTotals.values()).reduce((sum, v) => sum + v, 0);

  const members = groupMembers.filter((m) => memberTotals.has(m.id));
  const rawCents = members.map((m) => {
    const itemsTotal = memberTotals.get(m.id) ?? 0;
    const proportion = allClaimedTotal > 0 ? itemsTotal / allClaimedTotal : 0;
    const taxShare = receiptData.tax * proportion;
    const tipShare = receiptData.tip * proportion;
    return Math.round((itemsTotal + taxShare + tipShare) * 100);
  });

  // Distribute rounding remainder so splits sum to exactly the receipt total
  const expectedTotalCents = Math.round(receiptData.total * 100);
  const currentSum = rawCents.reduce((sum, c) => sum + c, 0);
  let remainder = expectedTotalCents - currentSum;
  const step = remainder > 0 ? 1 : -1;
  for (let i = 0; remainder !== 0 && i < rawCents.length; i++) {
    rawCents[i]! += step;
    remainder -= step;
  }

  return members.map((m, i) => ({
    recipientId: m.id,
    amount: rawCents[i]! / 100,
  }));
}

/** Compute full breakdown for display */
function computeBreakdown(
  receiptData: ReceiptData,
  groupMembers: GroupMember[],
  assignments: Assignments,
) {
  const memberItemTotals = new Map<string, number>();

  let claimedItemsTotal = 0;
  let unclaimedItems = 0;
  let unclaimedTotal = 0;

  receiptData.items.forEach((item, itemIndex) => {
    const assignees = assignments.get(itemIndex);
    const itemTotal = item.price * item.quantity;

    if (!assignees || assignees.size === 0) {
      unclaimedItems++;
      unclaimedTotal += itemTotal;
      return;
    }

    claimedItemsTotal += itemTotal;
    const perPerson = itemTotal / assignees.size;
    assignees.forEach((memberId) => {
      memberItemTotals.set(memberId, (memberItemTotals.get(memberId) ?? 0) + perPerson);
    });
  });

  const members = groupMembers.filter((m) => memberItemTotals.has(m.id));
  const rawBreakdown = members.map((m) => {
    const itemsTotal = memberItemTotals.get(m.id) ?? 0;
    const proportion = claimedItemsTotal > 0 ? itemsTotal / claimedItemsTotal : 0;
    const taxShare = receiptData.tax * proportion;
    const tipShare = receiptData.tip * proportion;
    return { member: m, itemsTotal, taxShare, tipShare, rawCents: Math.round((itemsTotal + taxShare + tipShare) * 100) };
  });

  // Distribute rounding remainder so displayed totals sum to the receipt total
  const expectedTotalCents = Math.round(receiptData.total * 100);
  const currentSum = rawBreakdown.reduce((sum, b) => sum + b.rawCents, 0);
  let remainder = expectedTotalCents - currentSum;
  const step = remainder > 0 ? 1 : -1;
  for (let i = 0; remainder !== 0 && i < rawBreakdown.length; i++) {
    rawBreakdown[i]!.rawCents += step;
    remainder -= step;
  }

  const perPersonBreakdown = rawBreakdown.map((b) => ({
    member: b.member,
    itemsTotal: b.itemsTotal,
    taxShare: b.taxShare,
    tipShare: b.tipShare,
    total: b.rawCents / 100,
  }));

  return { perPersonBreakdown, unclaimedItems, unclaimedTotal };
}
