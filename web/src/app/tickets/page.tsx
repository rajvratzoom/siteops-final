'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase, DEFAULT_SITE_ID } from '@/lib/supabase';
import { Ticket } from '@/types/database';
import { format, formatDistanceToNow } from 'date-fns';
import { FileText, CheckCircle2, Clock, XCircle, List, LayoutGrid, CalendarDays } from 'lucide-react';
import { AddTicketDialog } from '@/components/add-ticket-dialog';

type ViewMode = 'list' | 'board' | 'timeline';

function getStatusColor(status: string) {
  switch (status) {
    case 'Done':
      return 'bg-green-100 text-green-800';
    case 'In-Progress':
      return 'bg-blue-100 text-blue-800';
    case 'Blocked':
      return 'bg-red-100 text-red-800';
    case 'Backlog':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'Critical':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'High':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'Medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'Low':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'Done':
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case 'In-Progress':
      return <Clock className="w-4 h-4 text-blue-600" />;
    case 'Blocked':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <FileText className="w-4 h-4 text-gray-600" />;
  }
}

function ListView({ tickets }: { tickets: Ticket[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell>
              <Badge variant="outline" className="font-mono text-xs">
                {ticket.type}
              </Badge>
            </TableCell>
            <TableCell className="font-medium max-w-md">
              <div className="flex items-start gap-2">
                {getStatusIcon(ticket.status)}
                <div>
                  <div>{ticket.title}</div>
                  {ticket.description && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {ticket.description}
                    </div>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge className={getPriorityColor(ticket.priority)}>
                {ticket.priority}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={getStatusColor(ticket.status)}>
                {ticket.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-gray-600">
              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
            </TableCell>
            <TableCell className="text-sm">
              {ticket.due_date ? (
                <div
                  className={
                    new Date(ticket.due_date) < new Date()
                      ? 'text-red-600 font-medium'
                      : ''
                  }
                >
                  {format(new Date(ticket.due_date), 'MMM d, yyyy')}
                </div>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BoardView({ tickets }: { tickets: Ticket[] }) {
  const columns = ['Backlog', 'In-Progress', 'Blocked', 'Done'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {columns.map((status) => {
        const columnTickets = tickets.filter((t) => t.status === status);
        
        return (
          <div key={status} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">{status}</h3>
              <Badge variant="outline">{columnTickets.length}</Badge>
            </div>
            
            <div className="space-y-3">
              {columnTickets.map((ticket) => (
                <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {ticket.type}
                      </Badge>
                      <Badge className={getPriorityColor(ticket.priority) + ' text-xs'}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    
                    <h4 className="font-medium text-sm mb-2">{ticket.title}</h4>
                    
                    {ticket.description && (
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {ticket.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span>
                      {ticket.due_date && (
                        <span className={new Date(ticket.due_date) < new Date() ? 'text-red-600' : ''}>
                          {format(new Date(ticket.due_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {columnTickets.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No tickets
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineView({ tickets }: { tickets: Ticket[] }) {
  const sortedTickets = [...tickets].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      <div className="space-y-6">
        {sortedTickets.map((ticket, index) => (
          <div key={ticket.id} className="relative pl-16">
            {/* Timeline dot */}
            <div className="absolute left-6 top-2 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow" />
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ticket.type}
                    </Badge>
                    <Badge className={getStatusColor(ticket.status) + ' text-xs'}>
                      {ticket.status}
                    </Badge>
                    <Badge className={getPriorityColor(ticket.priority) + ' text-xs'}>
                      {ticket.priority}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                
                <h3 className="font-semibold mb-2">{ticket.title}</h3>
                
                {ticket.description && (
                  <p className="text-sm text-gray-600 mb-3">{ticket.description}</p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {ticket.phase && <span>Phase: {ticket.phase}</span>}
                  {ticket.discipline && <span>Discipline: {ticket.discipline}</span>}
                  {ticket.due_date && (
                    <span className={new Date(ticket.due_date) < new Date() ? 'text-red-600 font-medium' : ''}>
                      Due: {format(new Date(ticket.due_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('site_id', DEFAULT_SITE_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as Ticket[]);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsByStatus = tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
          <p className="text-gray-500 mt-1">Track initiatives, epics, and tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Board
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
            onClick={() => setViewMode('timeline')}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Timeline
          </Button>
          </div>
          <AddTicketDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Tickets</CardTitle>
            <FileText className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
            <Clock className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statsByStatus['In-Progress'] || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Backlog</CardTitle>
            <FileText className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {statsByStatus['Backlog'] || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Done</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsByStatus['Done'] || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'list' && 'All Tickets'}
            {viewMode === 'board' && 'Kanban Board'}
            {viewMode === 'timeline' && 'Timeline View'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No tickets yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create tickets from alerts or manually track safety tasks
              </p>
            </div>
          ) : (
            <>
              {viewMode === 'list' && <ListView tickets={tickets} />}
              {viewMode === 'board' && <BoardView tickets={tickets} />}
              {viewMode === 'timeline' && <TimelineView tickets={tickets} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}