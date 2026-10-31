import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import type { Event as EventType } from '@celebration-planner/shared';

export interface AddVendorModalProps {
  isOpen: boolean;
  eventId: string;
  currency: string;
  onClose: () => void;
  onEventUpdated: (updatedEvent: EventType) => void;
}

export function AddVendorModal({
  isOpen,
  eventId,
  currency,
  onClose,
  onEventUpdated,
}: AddVendorModalProps) {
  const [form, setForm] = useState({
    name: '',
    category: '',
    contactEmail: '',
    contactPhone: '',
    estimatedCost: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) {
      toast.error('Please provide vendor name and category');
      return;
    }
    try {
      setIsSubmitting(true);
      const updated = await api.addVendor(eventId, {
        name: form.name,
        category: form.category,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
        notes: form.notes || undefined,
        status: 'not_contacted',
        isAiSuggested: false,
      });
      onEventUpdated(updated);
      setForm({
        name: '',
        category: '',
        contactEmail: '',
        contactPhone: '',
        estimatedCost: '',
        notes: '',
      });
      onClose();
      toast.success('Vendor added to directory');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add vendor';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Vendor to Directory">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="add-vendor-name" className="block text-xs font-semibold text-charcoal mb-1">
            Vendor Name *
          </label>
          <input
            id="add-vendor-name"
            type="text"
            required
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            placeholder="e.g. Luminary Photography"
            className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
          />
        </div>

        <div>
          <label htmlFor="add-vendor-cat" className="block text-xs font-semibold text-charcoal mb-1">
            Category *
          </label>
          <input
            id="add-vendor-cat"
            type="text"
            required
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            placeholder="e.g. Catering, Floral, Music, Photo"
            className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="add-vendor-email" className="block text-xs font-semibold text-charcoal mb-1">
              Email
            </label>
            <input
              id="add-vendor-email"
              type="email"
              value={form.contactEmail}
              onChange={(e) =>
                setForm({ ...form, contactEmail: e.target.value })
              }
              placeholder="contact@vendor.com"
              className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="add-vendor-phone" className="block text-xs font-semibold text-charcoal mb-1">
              Phone
            </label>
            <input
              id="add-vendor-phone"
              type="tel"
              value={form.contactPhone}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value })
              }
              placeholder="+1 (555) 000-0000"
              className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="add-vendor-cost" className="block text-xs font-semibold text-charcoal mb-1">
            Estimated Cost ({currency})
          </label>
          <input
            id="add-vendor-cost"
            type="number"
            min="0"
            step="any"
            value={form.estimatedCost}
            onChange={(e) =>
              setForm({ ...form, estimatedCost: e.target.value })
            }
            placeholder="e.g. 2500"
            className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting}>
            Add Vendor
          </Button>
        </div>
      </form>
    </Modal>
  );
}
