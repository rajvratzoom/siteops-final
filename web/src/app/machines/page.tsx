import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase, DEFAULT_SITE_ID } from '@/lib/supabase';
import { Machine } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { Truck } from 'lucide-react';
import { AddMachineDialog } from '@/components/add-machine-dialog';

async function getMachines() {
  const { data: machines, error } = await supabase
    .from('machines')
    .select('*')
    .eq('site_id', DEFAULT_SITE_ID)
    .order('label');

  if (error) {
    console.error('Error fetching machines:', error);
    return [];
  }

  return (machines || []) as Machine[];
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Active':
      return 'bg-green-100 text-green-800';
    case 'Idle':
      return 'bg-yellow-100 text-yellow-800';
    case 'Off-Site':
      return 'bg-gray-100 text-gray-800';
    case 'Maintenance':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getMachineIcon(label: string) {
  // You can extend this with more specific icons
  return '🚜';
}

export default async function MachinesPage() {
  const machines = await getMachines();
  const activeMachines = machines.filter((m) => m.status === 'Active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Machines</h1>
          <p className="text-gray-500 mt-1">Track vehicles and heavy equipment</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-600">Active Machines</p>
            <p className="text-3xl font-bold text-green-600">{activeMachines.length}</p>
          </div>
          <AddMachineDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Machines</CardTitle>
            <Truck className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{machines.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeMachines.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Idle/Off-Site</CardTitle>
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {machines.length - activeMachines.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Machines</CardTitle>
        </CardHeader>
        <CardContent>
          {machines.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No machines registered yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Owner Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Zone</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getMachineIcon(machine.type)}</span>
                        <span className="capitalize">{machine.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {machine.asset_tag || '-'}
                    </TableCell>
                    <TableCell>{machine.owner_company || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(machine.status)}>
                        {machine.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{machine.zone || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {machine.last_seen_at
                        ? formatDistanceToNow(new Date(machine.last_seen_at), {
                            addSuffix: true,
                          })
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
