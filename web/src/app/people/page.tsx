'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase, DEFAULT_SITE_ID } from '@/lib/supabase';
import { Person, Ticket } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { AddPersonDialog } from '@/components/add-person-dialog';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

type PersonWithTickets = Person & {
  assignedTickets: Ticket[];
};

function getStatusColor(status: string) {
  switch (status) {
    case 'Working':
      return 'bg-green-100 text-green-800';
    case 'On-Break':
      return 'bg-yellow-100 text-yellow-800';
    case 'Off-Site':
      return 'bg-gray-100 text-gray-800';
    case 'Sick-Leave':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonWithTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const fetchPeopleWithTickets = async () => {
    setLoading(true);
    
    // Fetch people
    const { data: peopleData, error: peopleError } = await supabase
      .from('people')
      .select('*')
      .eq('site_id', DEFAULT_SITE_ID)
      .order('name');

    if (peopleError) {
      console.error('Error fetching people:', peopleError);
      setLoading(false);
      return;
    }

    // Fetch all tickets
    const { data: ticketsData, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .eq('site_id', DEFAULT_SITE_ID);

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError);
    }

    // Map tickets to people
    const peopleWithTickets: PersonWithTickets[] = (peopleData || []).map((person) => ({
      ...person,
      assignedTickets: (ticketsData || []).filter((ticket) =>
        ticket.assignees?.includes(person.id)
      ),
    }));

    setPeople(peopleWithTickets);
    setLoading(false);
  };

  useEffect(() => {
    fetchPeopleWithTickets();
  }, []);

  const updatePersonStatus = async (personId: string, newStatus: string) => {
    setUpdatingIds((prev) => new Set(prev).add(personId));

    const { error } = await supabase
      .from('people')
      .update({ 
        status: newStatus,
        status_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', personId);

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } else {
      // Update local state
      setPeople((prev) =>
        prev.map((p) =>
          p.id === personId
            ? { ...p, status: newStatus, status_updated_at: new Date().toISOString() }
            : p
        )
      );
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.delete(personId);
      return next;
    });
  };

  const toggleActiveOnSite = async (personId: string, currentStatus: string) => {
    // Toggle between Working and Off-Site
    const newStatus = currentStatus === 'Working' ? 'Off-Site' : 'Working';
    await updatePersonStatus(personId, newStatus);
  };

  const activePeople = people.filter((p) => p.status === 'Working');
  const expectedActiveCount = activePeople.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">People</h1>
          <p className="text-gray-500 mt-1">Manage workers and site personnel</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-600">Active On Site</p>
            <p className="text-3xl font-bold text-blue-600">{expectedActiveCount}</p>
          </div>
          <AddPersonDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workers ({people.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No people registered yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active On Site</TableHead>
                  <TableHead>Assigned Tickets</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell>{person.role || '-'}</TableCell>
                    <TableCell>{person.company || '-'}</TableCell>
                    <TableCell>
                      <Select
                        value={person.status}
                        onValueChange={(value) => updatePersonStatus(person.id, value)}
                        disabled={updatingIds.has(person.id)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Working">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              Working
                            </div>
                          </SelectItem>
                          <SelectItem value="On-Break">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              On-Break
                            </div>
                          </SelectItem>
                          <SelectItem value="Off-Site">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-gray-500" />
                              Off-Site
                            </div>
                          </SelectItem>
                          <SelectItem value="Sick-Leave">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              Sick-Leave
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={person.status === 'Working'}
                          onCheckedChange={() => toggleActiveOnSite(person.id, person.status)}
                          disabled={updatingIds.has(person.id)}
                        />
                        <span className="text-sm text-gray-600">
                          {person.status === 'Working' ? 'Yes' : 'No'}
                        </span>
                        {updatingIds.has(person.id) && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {person.assignedTickets.length === 0 ? (
                        <span className="text-sm text-gray-400">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {person.assignedTickets.slice(0, 3).map((ticket) => (
                            <Badge
                              key={ticket.id}
                              variant="outline"
                              className="text-xs cursor-pointer hover:bg-gray-100"
                              onClick={() => router.push('/tickets')}
                            >
                              {ticket.title.substring(0, 20)}
                              {ticket.title.length > 20 ? '...' : ''}
                            </Badge>
                          ))}
                          {person.assignedTickets.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{person.assignedTickets.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {person.last_seen_at
                        ? formatDistanceToNow(new Date(person.last_seen_at), {
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

      <Card>
        <CardHeader>
          <CardTitle>Headcount Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                The CV system will check every 5 minutes if the detected people count matches
                the expected active count.
              </p>
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Expected Active Workers
                  </p>
                  <p className="text-2xl font-bold text-blue-600">{expectedActiveCount}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-blue-800">
                    If the CV system detects a different number of people (mode over 5 minutes),
                    a &quot;Headcount Mismatch&quot; alert will be triggered.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Active Workers List:</h3>
              {activePeople.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No workers marked as active. Toggle the &quot;Active On Site&quot; switch to mark
                  workers as present.
                </p>
              ) : (
                <ul className="space-y-2">
                  {activePeople.map((person) => (
                    <li key={person.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{person.name}</span>
                        {person.role && <span className="text-gray-600"> • {person.role}</span>}
                        {person.company && <span className="text-gray-500"> • {person.company}</span>}
                      </div>
                      {person.assignedTickets.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {person.assignedTickets.length} {person.assignedTickets.length === 1 ? 'ticket' : 'tickets'}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}