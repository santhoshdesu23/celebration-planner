import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AddVendorModal } from './AddVendorModal';
import type { Event as EventType, VendorStatus } from '@celebration-planner/shared';

export interface VendorsTabProps {
  event: EventType;
  onEventUpdated: (updatedEvent: EventType) => void;
}

export function VendorsTab({ event, onEventUpdated }: VendorsTabProps) {
  const [showAddVendor, setShowAddVendor] = useState(false);
  const currency = event.budget.currency;

  const handleUpdateVendorStatus = async (
    vendorId: string,
    newStatus: VendorStatus
  ) => {
    try {
      const updated = await api.updateVendor(event.id, vendorId, {
        status: newStatus,
      });
      onEventUpdated(updated);
      toast.success(`Vendor status set to ${newStatus.replace('_', ' ')}`);
    } catch (err: unknown) {
      toast.error('Could not update vendor status');
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    try {
      const updated = await api.deleteVendor(event.id, vendorId);
      onEventUpdated(updated);
      toast.success('Vendor deleted');
    } catch (err: unknown) {
      toast.error('Could not delete vendor');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-charcoal">
            Vendor Directory & Pipeline
          </h2>
          <p className="text-sm text-muted">
            Track vendor outreach, quotations, confirmed costs, and contact info.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddVendor(true)}
          leftIcon={<Plus size={14} />}
        >
          Add Vendor
        </Button>
      </div>

      {/* Honest Planning Advisory */}
      <div className="flex items-start gap-3 p-4 bg-ivory-100 border border-ivory-200 rounded-2xl text-charcoal text-xs leading-relaxed">
        <Info className="w-4 h-4 text-plum flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-plum">Planning Transparency & Pricing Advisory:</span>{' '}
          AI-suggested vendors serve as benchmark models and typical regional price baselines. Celebration Planner does not hold live inventory, guarantee date availability, or execute real-world contracts. Please contact local providers directly to obtain verified proposals and binding service agreements.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {event.vendors.map((vendor) => {
          const statusColors: Record<VendorStatus, { bg: string; text: string }> = {
            not_contacted: { bg: 'bg-gray-100', text: 'text-gray-700' },
            contacted: { bg: 'bg-blue-100', text: 'text-blue-800' },
            quote_received: { bg: 'bg-purple-100', text: 'text-purple-800' },
            booked: { bg: 'bg-green-100', text: 'text-green-800' },
            cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
          };

          return (
            <div
              key={vendor.id}
              className="bg-white rounded-3xl border border-ivory-200 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-muted">
                      {vendor.category}
                    </span>
                    <h3 className="font-display text-xl font-bold text-charcoal">
                      {vendor.name}
                    </h3>
                  </div>
                  {vendor.isAiSuggested && (
                    <Badge variant="plum" size="sm">
                      AI Suggested
                    </Badge>
                  )}
                </div>

                {vendor.notes && (
                  <p className="text-xs text-charcoal-light italic mb-3">
                    &ldquo;{vendor.notes}&rdquo;
                  </p>
                )}

                <div className="space-y-1.5 text-xs text-muted">
                  {vendor.contactEmail && (
                    <p>
                      📧 Email:{' '}
                      <a
                        href={`mailto:${vendor.contactEmail}`}
                        className="text-plum hover:underline"
                      >
                        {vendor.contactEmail}
                      </a>
                    </p>
                  )}
                  {vendor.contactPhone && (
                    <p>📞 Phone: {vendor.contactPhone}</p>
                  )}
                  {vendor.estimatedCost !== undefined && (
                    <p className="font-medium text-charcoal">
                      💵 Benchmark Estimate: {formatCurrency(vendor.estimatedCost, currency)}
                    </p>
                  )}
                  {vendor.confirmedCost !== undefined && (
                    <p className="font-bold text-green-700">
                      ✓ Confirmed Quote: {formatCurrency(vendor.confirmedCost, currency)}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-ivory-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">Status:</span>
                  <select
                    value={vendor.status}
                    onChange={(e) =>
                      handleUpdateVendorStatus(
                        vendor.id,
                        e.target.value as VendorStatus
                      )
                    }
                    className={`text-xs font-semibold px-2.5 py-1 rounded-xl border border-ivory-300 ${
                      statusColors[vendor.status]?.bg || 'bg-gray-100'
                    } ${statusColors[vendor.status]?.text || 'text-charcoal'}`}
                  >
                    <option value="not_contacted">Not Contacted</option>
                    <option value="contacted">Contacted</option>
                    <option value="quote_received">Quote Received</option>
                    <option value="booked">Booked ✓</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <button
                  onClick={() => handleDeleteVendor(vendor.id)}
                  className="text-muted hover:text-red-600 p-1"
                  aria-label="Delete vendor"
                  title="Delete vendor"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AddVendorModal
        isOpen={showAddVendor}
        eventId={event.id}
        currency={currency}
        onClose={() => setShowAddVendor(false)}
        onEventUpdated={onEventUpdated}
      />
    </div>
  );
}
