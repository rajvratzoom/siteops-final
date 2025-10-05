'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase, DEFAULT_SITE_ID } from '@/lib/supabase';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AddMachineDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    type: 'truck',
    asset_tag: '',
    owner_company: '',
    status: 'Idle',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('machines').insert([
        {
          site_id: DEFAULT_SITE_ID,
          ...formData,
        },
      ]);

      if (error) throw error;

      setOpen(false);
      setFormData({
        label: '',
        type: 'truck',
        asset_tag: '',
        owner_company: '',
        status: 'Idle',
      });
      router.refresh();
    } catch (error) {
      console.error('Error adding machine:', error);
      alert('Failed to add machine. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Machine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Machine</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Label *</label>
            <Input
              required
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Excavator #1, Forklift A"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Type *</label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="excavator">Excavator</SelectItem>
                <SelectItem value="forklift">Forklift</SelectItem>
                <SelectItem value="crane">Crane</SelectItem>
                <SelectItem value="bulldozer">Bulldozer</SelectItem>
                <SelectItem value="loader">Loader</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Asset Tag</label>
            <Input
              value={formData.asset_tag}
              onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
              placeholder="EXC-001, TRK-042"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Owner Company</label>
            <Input
              value={formData.owner_company}
              onChange={(e) => setFormData({ ...formData, owner_company: e.target.value })}
              placeholder="Company name"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Status *</label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Idle">Idle</SelectItem>
                <SelectItem value="Off-Site">Off-Site</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Machine'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
