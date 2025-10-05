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
import { Alert as AlertType } from '@/types/database';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { AcknowledgeAlertButton } from '@/components/acknowledge-alert-button';

async function getAlerts() {
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('site_id', DEFAULT_SITE_ID)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }

  return (alerts || []) as AlertType[];
}

function getSeverityColor(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    default:
      return 'bg-blue-100 text-blue-800 border-blue-300';
  }
}

function getAlertTypeLabel(type: string) {
  switch (type) {
    case 'ProximityWarning':
      return '⚠️ Proximity Warning';
    case 'PersonDown':
      return '🚨 Person Down';
    case 'HeadcountMismatch':
      return '👥 Headcount Mismatch';
    default:
      return type;
  }
}

function getAlertIcon(type: string) {
  switch (type) {
    case 'ProximityWarning':
      return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    case 'PersonDown':
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    case 'HeadcountMismatch':
      return <AlertTriangle className="w-4 h-4 text-blue-600" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-gray-600" />;
  }
}

export default async function AlertsPage() {
  const allAlerts = await getAlerts();
  // Only show unacknowledged alerts by default
  const alerts = allAlerts.filter((a) => !a.acknowledged);
  const unacknowledged = alerts;
  const acknowledged = allAlerts.filter((a) => a.acknowledged);

  // Stats by type
  const statsByType = alerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
        <p className="text-gray-500 mt-1">Safety events and warnings from the CV system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Alerts</CardTitle>
            <AlertTriangle className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Unacknowledged</CardTitle>
            <Clock className="w-4 h-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{unacknowledged.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Acknowledged</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{acknowledged.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Proximity Warnings</CardTitle>
            <div className="text-xl">⚠️</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsByType['ProximityWarning'] || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No alerts yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id} className={alert.acknowledged ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getAlertIcon(alert.type)}
                        <span className="text-sm font-medium">
                          {getAlertTypeLabel(alert.type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{format(new Date(alert.created_at), 'MMM d, HH:mm:ss')}</div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {alert.type === 'ProximityWarning' && alert.metadata && (
                        <div>
                          <div className="font-medium">Person near {(alert.metadata as any).vehicle_type || 'vehicle'}</div>
                          <div className="text-xs text-gray-500">
                            Distance: {(alert.metadata as any).distance_px}px
                          </div>
                        </div>
                      )}
                      {alert.type === 'PersonDown' && (
                        <div>Person #{alert.person_id || alert.person_track_id} detected down</div>
                      )}
                      {alert.type === 'HeadcountMismatch' && alert.metadata && (
                        <div>
                          <div className="font-medium">Headcount Mismatch</div>
                          <div className="text-xs text-gray-500">
                            Mode: {(alert.metadata as any).mode_count}, Current: {(alert.metadata as any).current_count}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {alert.snapshot_url ? (
                        <a 
                          href={alert.snapshot_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img 
                            src={alert.snapshot_url} 
                            alt="Alert snapshot" 
                            className="w-24 h-16 object-cover rounded border border-gray-200 hover:scale-150 transition-transform cursor-pointer"
                          />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">No image</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {alert.acknowledged ? (
                        <Badge variant="outline" className="bg-green-50">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Acknowledged
                        </Badge>
                      ) : (
                        <AcknowledgeAlertButton alertId={alert.id} />
                      )}
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
