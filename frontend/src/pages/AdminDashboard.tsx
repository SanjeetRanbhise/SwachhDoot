import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/api';
import { Complaint } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type StatusFilter = 'ALL' | 'REPORTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLEANED' | 'VERIFIED' | 'CLOSED';
type ReportType = 'weekly' | 'monthly';

type ReportSummary = {
  total: number;
  reported: number;
  assigned: number;
  in_progress: number;
  cleaned: number;
  verified: number;
  closed: number;
};

const statusLabelMap: Record<Exclude<StatusFilter, 'ALL'>, string> = {
  REPORTED: 'Reported',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  CLEANED: 'Cleaned',
  VERIFIED: 'Verified',
  CLOSED: 'Closed',
};

const statusColorMap: Record<Exclude<StatusFilter, 'ALL'>, string> = {
  REPORTED: 'text-red-600 bg-red-50 border-red-200',
  ASSIGNED: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  IN_PROGRESS: 'text-purple-600 bg-purple-50 border-purple-200',
  CLEANED: 'text-green-600 bg-green-50 border-green-200',
  VERIFIED: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  CLOSED: 'text-indigo-600 bg-indigo-50 border-indigo-200',
};

const getWeekStart = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const currentDay = next.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  next.setDate(next.getDate() + diff);
  return next.toISOString().slice(0, 10);
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};


function getReadableStatus(complaint: {
  status: string;
  user_name?: string | null;
  reporter_name?: string | null;
  collector_name?: string | null;
}): string {
  const citizenName =
    complaint.user_name || complaint.reporter_name || 'Citizen';

  const wmtName =
    complaint.collector_name || 'Waste Management Team';

  switch (complaint.status) {
    case 'REPORTED':
      return `Reported by user (${citizenName})`;

    case 'ASSIGNED':
      return `Assigned to WMT (${wmtName})`;

    case 'IN_PROGRESS':
      return `In progress by WMT (${wmtName})`;

    case 'CLEANED':
      return `Cleaned by WMT (${wmtName})`;

    case 'VERIFIED':
      return `Cleaning verified by citizen (${citizenName})`;

    case 'CLOSED':
      return 'Complaint closed';

    default:
      return complaint.status.replace(/_/g, ' ');
  }
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Could not load the SwachhDoot logo.');
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not convert the logo image.'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read the logo.'));
    reader.readAsDataURL(blob);
  });
}


export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total: 0,
    reported: 0,
    assigned: 0,
    in_progress: 0,
    cleaned: 0,
    verified: 0,
    closed: 0,
  });

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null);
  const [selectedCollectorId, setSelectedCollectorId] = useState<number | null>(null);
  const [selectedCleaningHours, setSelectedCleaningHours] = useState<number>(24);
  const [collectors, setCollectors] = useState<any[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<any[]>([]);
  const [adminError, setAdminError] = useState('');
  const [adminActionId, setAdminActionId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('ALL');
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [assignError, setAssignError] = useState('');
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(getWeekStart());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [reportData, setReportData] = useState<{ summary: ReportSummary; complaints: Complaint[]; report_period: string } | null>(null);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/login');
      return;
    }

    loadData();
  }, [user]);

  const loadData = async (status: StatusFilter = selectedStatus) => {
    console.log('Current user:', user);
    console.log('Is primary admin:', user?.is_primary_admin);
    try {
      const requests = [
        adminService.getDashboard(),
        adminService.getComplaints(status === 'ALL' ? undefined : status),
        adminService.getCollectors(),
      ];
      if (user?.is_primary_admin) {
        requests.push(adminService.getApprovalRequests());
      }

      const [dashRes, complRes, collRes, approvalRequestsRes] = await Promise.all(requests);

      setStats(dashRes.data);
      setComplaints(complRes.data);
      setCollectors(collRes.data);
      if (approvalRequestsRes) setApprovalRequests(approvalRequestsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = async (status: StatusFilter) => {
    setSelectedStatus(status);
    await loadData(status);
  };

  const handleAdminAction = async (adminId: number, action: 'approve' | 'reject') => {
    setAdminActionId(adminId);
    setAdminError('');
    try {
      if (action === 'approve') {
        await adminService.approveAdmin(adminId);
      } else {
        await adminService.rejectAdmin(adminId);
      }
      const response = await adminService.getApprovalRequests();
      setApprovalRequests(response.data);
    } catch (error: any) {
      setAdminError(error.response?.data?.error || 'Admin account could not be updated.');
    } finally {
      setAdminActionId(null);
    }
  };

  

const handleAssign = async (
  complaintId: number,
  collectorId: number
) => {
  try {
    console.log('Assigning complaint:', {
      complaintId,
      collectorId,
      expectedCleaningHours: selectedCleaningHours,
    });

    const response = await adminService.assignComplaint(
      complaintId,
      collectorId,
      selectedCleaningHours
    );

    console.log('Assignment successful:', response.data);

    await loadData();
    setSelectedComplaintId(null);
    setSelectedCollectorId(null);
  } catch (error: any) {
    console.error('Failed to assign complaint:', error);

    alert(
      error.response?.data?.error ||
      error.message ||
      'Assignment failed. Check the browser console and backend terminal.'
    );
  }
};



  const handleGenerateReport = async () => {
    setReportError('');
    try {
      const params = {
        type: reportType,
        date: reportType === 'weekly' ? selectedWeekStart : `${selectedMonth}-01`,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
      };
      const response = await adminService.getReports(params);
      setReportData(response.data);
    } catch (error: any) {
      setReportError(error.response?.data?.error || 'Report could not be generated.');
    }
  };
  const handleDownloadPDF = async() => {
  if (!reportData) {
    alert('Please generate a report first.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

try {
  const logoData = await loadImageAsDataUrl('/swachhdoot-logo.png');

  doc.addImage(
    logoData,
    'PNG',
    14, 2,
    36, 28
  );
} catch (error) {
  console.error('Failed to load SwachhDoot logo:', error);
}

  const summary = reportData.summary || {};
  const complaints = reportData.complaints || [];

 
  // SwachhDoot branded header and logo
  doc.setFontSize(9);
  doc.text(
    `Report Period: ${reportData.report_period || 'Selected period'}`,
    283, 16, { align: 'right' }
  );
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    283, 23, { align: 'right' }
  );

  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.8);
  doc.line(14, 31, 283, 31);

  doc.setTextColor(25, 45, 65);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SANITATION COMPLAINT REPORT', 148.5, 40, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Total: ${summary.total ?? 0} | Reported: ${summary.reported ?? 0} | Assigned: ${summary.assigned ?? 0} | In Progress: ${summary.in_progress ?? 0}`,
    14, 49
  );

  doc.text(
    `Cleaned: ${summary.cleaned ?? 0} | Verified: ${summary.verified ?? 0} | Closed: ${summary.closed ?? 0}`,
    14, 55
  );

  const rows = complaints.map((c: any) => [
  String(c.complaint_id || c.id || '-'),
  c.complaint_date
    ? new Date(c.complaint_date).toLocaleDateString()
    : '-',
  c.user_name || '-',
  c.waste_type || '-',
  c.waste_intensity
    ? String(c.waste_intensity).toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
    : 'Not set',
  getReadableStatus(c),
  c.collector_name || '-',
  String(c.rating ?? '-'),
  c.feedback || '-',
]);

  autoTable(doc, {
    startY: 61,
   head: [[
  'Complaint ID',
  'Date',
  'Citizen Name',
  'Type of Waste',
  'Waste Intensity',
  'Status',
  'Collector / WMT',
  'Rating',
  'Feedback',
]],
    body: rows.length ? rows : [['-', '-', '-', '-', '-', '-', '-', 'No complaints found']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 163, 74] },
    margin: { left: 14, right: 14 },
  });

  
  // Signing Authority section
  const finalTableY = (doc as any).lastAutoTable?.finalY ?? 70;
  const pageHeight = doc.internal.pageSize.getHeight();

  let signY = finalTableY + 12;

  // Start a new page if there isn't enough room
  if (signY + 35 > pageHeight - 10) {
    doc.addPage();
    signY = 18;
  }

  doc.setFillColor(240, 248, 243);
  doc.setDrawColor(190, 215, 200);
  doc.roundedRect(14, signY, 269, 34, 2, 2, 'FD');

  doc.setTextColor(25, 45, 35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Signing Authority', 19, signY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setDrawColor(90, 100, 95);

  doc.text('Name', 19, signY + 15);
  doc.line(19, signY + 22, 65, signY + 22);

  doc.text('Designation', 73, signY + 15);
  doc.line(73, signY + 22, 126, signY + 22);

  doc.text('Signature', 134, signY + 15);
  doc.line(134, signY + 22, 187, signY + 22);

  doc.text('Date', 195, signY + 15);
  doc.line(195, signY + 22, 224, signY + 22);

  doc.rect(237, signY + 10, 38, 18);
  doc.setFontSize(8);
  doc.text('Official Seal', 256, signY + 18, {
    align: 'center',
  });
  doc.text('(Optional)', 256, signY + 24, {
    align: 'center',
  });


  doc.save(`SwachhDoot-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
};

  const tableHeading = selectedStatus === 'ALL' ? 'All Complaints' : `${statusLabelMap[selectedStatus]} Complaints`;
  const pendingAdmins = approvalRequests;

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          @page { margin: 10mm; }
          body { background: white !important; }
          body * { visibility: hidden !important; }
          .report-shell, .report-shell * { visibility: visible !important; }
          .report-shell {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 1px solid #d1d5db;
          }
          .no-print { display: none !important; }
          .print-table td, .print-table th { font-size: 11px; }
        }
      `}</style>

      <nav className="no-print bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <img
            src="/swachhdoot-logo.png"
            alt="SwachhDoot Smart Waste Management System"
            className="h-20 w-auto object-contain"
          />
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{user?.name}</span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { key: 'ALL' as const, count: stats.total, label: 'Total Complaints', color: 'text-blue-600' },
            { key: 'REPORTED' as const, count: stats.reported, label: 'Reported', color: 'text-red-600' },
            { key: 'ASSIGNED' as const, count: stats.assigned, label: 'Assigned', color: 'text-yellow-600' },
            { key: 'IN_PROGRESS' as const, count: stats.in_progress, label: 'In Progress', color: 'text-purple-600' },
            { key: 'CLEANED' as const, count: stats.cleaned, label: 'Cleaned', color: 'text-green-600' },
            { key: 'VERIFIED' as const, count: stats.verified, label: 'Verified', color: 'text-cyan-600' },
            { key: 'CLOSED' as const, count: stats.closed, label: 'Closed', color: 'text-indigo-600' },
          ].map((card) => {
            const isSelected = selectedStatus === card.key;
            const activeClass = isSelected ? 'ring-2 ring-green-500 border-green-200 bg-green-50' : 'hover:shadow-md';
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => handleStatusFilter(card.key)}
                className={`bg-white rounded-lg shadow p-4 text-left transition-all border ${activeClass}`}
              >
                <div className={`text-3xl font-bold ${card.color}`}>{card.count}</div>
                <div className="text-gray-600 text-sm">{card.label}</div>
              </button>
            );
          })}
        </div>

        <div className="no-print mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-gray-600">
            {selectedStatus === 'ALL' ? 'Selected: View All Complaints' : `Selected: ${statusLabelMap[selectedStatus]}`}
          </div>
          {selectedStatus !== 'ALL' && (
            <button
              type="button"
              onClick={() => handleStatusFilter('ALL')}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900"
            >
              View All Complaints
            </button>
          )}
        </div>

        {user?.is_primary_admin && <section className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Pending Admin Approval</h3>
              <p className="text-sm text-gray-600">Only the Primary Admin can approve or reject Admin accounts.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">{pendingAdmins.length} pending</span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">PRIMARY ADMIN</span>
            </div>
          </div>

          <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            {pendingAdmins.length > 0 ? `${pendingAdmins.length} pending Admin approval request${pendingAdmins.length > 1 ? 's' : ''}.` : 'No pending Admin approval requests.'}
          </div>

          {adminError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{adminError}</div>}

          {pendingAdmins.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b"><tr><th className="px-4 py-3 text-left text-sm">Name</th><th className="px-4 py-3 text-left text-sm">Email</th><th className="px-4 py-3 text-left text-sm">Phone</th><th className="px-4 py-3 text-left text-sm">Requested</th><th className="px-4 py-3 text-left text-sm">Status</th><th className="px-4 py-3 text-left text-sm">Action</th></tr></thead>
                <tbody>{pendingAdmins.map((admin) => <tr key={admin.id} className="border-b">
                  <td className="px-4 py-3 text-sm">{admin.name}</td>
                  <td className="px-4 py-3 text-sm">{admin.email}</td>
                  <td className="px-4 py-3 text-sm">{admin.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm">{admin.requested_at ? new Date(admin.requested_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">{admin.status}</span></td>
                  <td className="px-4 py-3 text-sm">{assignError && (
                 <p className="text-sm text-red-600 mb-3">
                  {assignError}
                    </p>
                      )}<div className="flex gap-2"><button onClick={() => handleAdminAction(admin.admin_user_id, 'approve')} disabled={adminActionId === admin.admin_user_id} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50">{adminActionId === admin.admin_user_id ? 'Updating...' : 'Approve'}</button><button onClick={() => handleAdminAction(admin.admin_user_id, 'reject')} disabled={adminActionId === admin.admin_user_id} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50">Reject</button></div></td>
                </tr>)}</tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No pending Admin approval requests.</p>
          )}

        </section>}

        <section className="no-print bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Reports</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-gray-700">
              Report Type
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value as ReportType)}
                className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            {reportType === 'weekly' ? (
              <label className="block text-sm font-medium text-gray-700">
                Week Starting
                <input
                  type="date"
                  value={selectedWeekStart}
                  onChange={(event) => setSelectedWeekStart(event.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </label>
            ) : (
              <label className="block text-sm font-medium text-gray-700">
                Month
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </label>
            )}

            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={handleGenerateReport}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Generate Report
              </button>
              <button
                type="button"
                onClick={() => {
                  if (reportData) {
                    window.print();
                  } else {
                    handleGenerateReport();
                  }
                }}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Print Report
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                 disabled={!reportData}
                className="flex-1 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50"
                >
               Download PDF
              </button>
            </div>
          </div>
          {reportError && <div className="mt-4 text-sm text-red-600">{reportError}</div>}
        </section>

        {reportData && (
          <section className="report-shell bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="mb-6 border-b pb-4">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900">SWACHHDOOT</h3>
                <p className="text-sm text-gray-600">Smart Waste Management System</p>
                <p className="mt-2 text-lg font-semibold text-gray-800">ADMINISTRATIVE REPORT</p>
              </div>
              <div className="mt-4 text-sm text-gray-700">
                <strong>Report Period:</strong> {reportData.report_period}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-xl font-semibold text-gray-800 mb-3">SUMMARY</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="border rounded p-3 bg-gray-50"><span className="block text-gray-500">Total Complaints</span><strong>{reportData.summary.total}</strong></div>
                <div className="border rounded p-3 bg-red-50"><span className="block text-gray-500">Reported</span><strong>{reportData.summary.reported}</strong></div>
                <div className="border rounded p-3 bg-yellow-50"><span className="block text-gray-500">Assigned</span><strong>{reportData.summary.assigned}</strong></div>
                <div className="border rounded p-3 bg-purple-50"><span className="block text-gray-500">In Progress</span><strong>{reportData.summary.in_progress}</strong></div>
                <div className="border rounded p-3 bg-green-50"><span className="block text-gray-500">Cleaned</span><strong>{reportData.summary.cleaned}</strong></div>
                <div className="border rounded p-3 bg-cyan-50"><span className="block text-gray-500">Verified</span><strong>{reportData.summary.verified}</strong></div>
                <div className="border rounded p-3 bg-indigo-50"><span className="block text-gray-500">Closed</span><strong>{reportData.summary.closed}</strong></div>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">COMPLAINT DETAILS</h4>
              <div className="overflow-x-auto">
                
<table className="print-table w-full text-left border-collapse">
  <thead className="bg-gray-100">
    <tr>
      <th className="px-3 py-2 text-xs font-semibold">Complaint ID</th>
      <th className="px-3 py-2 text-xs font-semibold">Date</th>
      <th className="px-3 py-2 text-xs font-semibold">Citizen Name</th>
      <th className="px-3 py-2 text-xs font-semibold">Type of Waste</th>
      <th className="px-3 py-2 text-xs font-semibold">Intensity</th>
      <th className="px-3 py-2 text-xs font-semibold">Status</th>
      <th className="px-3 py-2 text-xs font-semibold">Collector / WMT</th>
      <th className="px-3 py-2 text-xs font-semibold">Rating</th>
      <th className="px-3 py-2 text-xs font-semibold">Feedback</th>
    </tr>
  </thead>
  <tbody>
    {reportData.complaints.length ? (
      reportData.complaints.map((complaint) => (
        <tr key={complaint.id} className="border-b text-sm align-top">
          <td className="px-3 py-2">{complaint.complaint_id}</td>
          <td className="px-3 py-2">
            {formatDate(complaint.complaint_date ?? undefined)}
          </td>
          <td className="px-3 py-2">
            {complaint.user_name || complaint.reporter_name || '—'}
          </td>
          <td className="px-3 py-2">{complaint.waste_type}</td>
          <td className="px-3 py-2">
            {complaint.waste_intensity || 'Not set'}
          </td>
          <td className="px-3 py-2">
            {getReadableStatus(complaint)}
          </td>
          <td className="px-3 py-2">
            {complaint.collector_name || '—'}
          </td>
          <td className="px-3 py-2">
            {complaint.rating ? `${complaint.rating}/5` : '—'}
          </td>
          <td className="px-3 py-2">
            {complaint.feedback || '—'}
          </td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan={9} className="px-3 py-4 text-sm text-gray-500">
          No complaints found for this period.
        </td>
      </tr>
    )}
  </tbody>
</table>

              </div>
            </div>

            <div className="mt-6 text-sm text-gray-700">
              <strong>Generated on:</strong> {new Date().toLocaleString()}
            </div>
          </section>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">{tableHeading}</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Waste Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Intensity</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Citizen</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Address / Details</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Collector</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Cleaning / Verification</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      {selectedStatus === 'ALL'
                        ? 'No complaints found.'
                        : `No complaints are currently ${statusLabelMap[selectedStatus].toLowerCase()}.`}
                    </td>
                  </tr>
                ) : complaints.map((complaint) => (
                  <tr key={complaint.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-800">{complaint.complaint_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {complaint.waste_type}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {complaint.waste_intensity || 'Not set'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColorMap[complaint.status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        {getReadableStatus(complaint)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">{complaint.user_name || complaint.reporter_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-800"><div>{complaint.address || '—'}</div><div className="text-gray-500">{complaint.description}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-800">{complaint.collector_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      <div>{complaint.cleaned_at ? formatDate(complaint.cleaned_at) : '—'}</div>
                      {complaint.cleaning_image_url && <img src={`http://127.0.0.1:3001${complaint.cleaning_image_url}`} alt="Cleaning" className="mt-1 h-12 w-16 object-cover rounded" />}
                      <div>{complaint.rating ? `${complaint.rating}/5` : 'Not verified'}</div>
                      {complaint.feedback && <div className="text-gray-500">{complaint.feedback}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {complaint.status === 'REPORTED' && (
                        <button
                          onClick={() => setSelectedComplaintId(complaint.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Assign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>


{selectedComplaintId && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
      <h3 className="text-lg font-semibold mb-4">Assign Collector</h3>

      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Collector *
      </label>

      <select
        value={selectedCollectorId || ''}
        onChange={(e) =>
          setSelectedCollectorId(
            e.target.value ? Number(e.target.value) : null
          )
        }
        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
      >
        <option value="">Select Collector</option>
        {collectors.map((col) => (
          <option key={col.id} value={col.id}>
            {col.name}
          </option>
        ))}
      </select>

      <label className="block text-sm font-medium text-gray-700 mb-2">
        Cleaning Deadline *
      </label>

      <select
        value={selectedCleaningHours}
        onChange={(e) =>
          setSelectedCleaningHours(Number(e.target.value))
        }
        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
      >
        <option value={6}>Within 6 hours</option>
        <option value={12}>Within 12 hours</option>
        <option value={24}>Within 24 hours</option>
        <option value={48}>Within 48 hours</option>
        <option value={72}>Within 72 hours</option>
      </select>

      <div className="flex gap-2">
     
<button
  type="button"
  onClick={() => {
    if (!selectedComplaintId || !selectedCollectorId) {
      alert('Please select a collector first.');
      return;
    }

    handleAssign(selectedComplaintId, selectedCollectorId);
  }}
  disabled={!selectedCollectorId}
  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
>
  Assign
</button>


        <button
          onClick={() => setSelectedComplaintId(null)}
          className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};