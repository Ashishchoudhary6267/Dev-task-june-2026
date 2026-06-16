import api from "@/lib/api";
import * as XLSX from 'xlsx';
// ── Report 1: Generate User Activity Report ────────────────────────────────────

export const handleGenerate1 = async (selectedUser: string, range1: string, customFrom?: string, customTo?: string) => {
    if (!selectedUser) return;
    try {
        const res = await api.get('/reports/user-activity', {
            params: { user_id: selectedUser, range: range1, from: customFrom, to: customTo },
        });
        const { user, range: rangeInfo, activityRows, instanceRows, approvalRows } = res.data;
        const wb = XLSX.utils.book_new();

        // Sheet 1: User Activity
        const ws1 = XLSX.utils.aoa_to_sheet([
            ['Task Title', 'Role', 'Instance', 'Project', 'Status', 'Assigned At', 'Submitted At', 'Approved At', 'Estimated (mins)', 'Actual Working (mins)'],
            ...(activityRows || []).map((r: any) => [r.taskTitle, r.role || 'Worker', r.instance, r.project, r.status, r.assignedAt, r.submittedAt, r.approvedAt, r.estimatedMinutes, r.actualWorkingMinutes]),
        ]);
        ws1['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'User Activity');

        // Sheet 2: Instance Usage
        const ws2 = XLSX.utils.aoa_to_sheet([
            ['Instance Name', 'Project', 'Client', 'Status', 'Created At', 'Total Tasks', 'Completed Tasks'],
            ...(instanceRows || []).map((r: any) => [r.instanceName, r.project, r.client, r.instanceStatus, r.createdAt, r.totalTasks, r.completedTasks]),
        ]);
        ws2['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Instance Usage');

        // Sheet 3: Approval Workflow
        const ws3 = XLSX.utils.aoa_to_sheet([
            ['Task Title', 'Final Status', 'Total Rejections', 'Rejection Reasons (Chronological)', 'Approved By', 'Approved At'],
            ...(approvalRows || []).map((r: any) => [r.taskTitle, r.finalStatus, r.totalRejections, r.rejectionReasons, r.approvedBy, r.approvedAt]),
        ]);
        ws3['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 60 }, { wch: 22 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, ws3, 'Approval Workflow');

        const fileName = `User_Activity_${user.name.replace(/\s+/g, '_')}_${rangeInfo.label.split(' ')[0]}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch {
        alert('Failed to generate report. Please try again.');
    }
};



// ── Report 2: Generate Task Performance Report ────────────────────────────────────
export const handleGenerate2 = async (range2: string, customFrom?: string, customTo?: string) => {

    try {
        const res = await api.get('/reports/task-performance', {
            params: { range: range2, from: customFrom, to: customTo },
        });
        const { range: rangeInfo, summaryRows, detailRows } = res.data;
        const wb = XLSX.utils.book_new();

        // Sheet 1: Team Summary
        const ws1 = XLSX.utils.aoa_to_sheet([
            ['Name', 'Email', 'Role', 'Total Tasks', 'Completed', 'In Progress', 'Overdue', 'Upcoming', 'On-Time', 'Late', 'On-Time %', 'Avg Working Time (mins)'],
            ...(summaryRows || []).map((r: any) => [
                r.name, r.email, r.role, r.totalTasks, r.completed, r.inProgress,
                r.overdue, r.upcoming, r.completedOnTime, r.completedLate,
                r.onTimeDeliveryPct, r.avgActualWorkingMins,
            ]),
        ]);
        ws1['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Team Summary');

        // Sheet 2: Task Details
        const ws2 = XLSX.utils.aoa_to_sheet([
            ['Member', 'Role', 'Task Title', 'Instance', 'Project', 'Status', 'Assigned At', 'Submitted At', 'Approved At', 'Cycle Time', 'Approval Time', 'Estimated (mins)', 'Actual (mins)', 'Approver Comments'],
            ...(detailRows || []).map((r: any) => [
                r.memberName, r.memberRole, r.taskTitle, r.instance, r.project,
                r.performanceStatus, r.assignedAt, r.submittedAt, r.approvedAt,
                r.cycleTime, r.approvalTime, r.estimatedMins, r.actualWorkingMins, r.approverComments,
            ]),
        ]);
        ws2['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Task Details');

        const rangeLabel = rangeInfo.label.split(' ')[0];
        const fileName = `Task_Performance_Analytics_${rangeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch {
        alert('Failed to generate report. Please try again.');
    }
};
