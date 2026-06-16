'use client';

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import {
    Button,
    Badge,
    Input,
    Textarea,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';

import {
    Building2,
    User,
    Users,
    Mail,
    Phone,
    Globe,
    MapPin,
    Briefcase,
    Target,
    CheckCircle2,
    XCircle,
    Clock,
    Eye,
    RefreshCw,
} from 'lucide-react';
import { OnboardingRequest } from '@/lib/types/auth';

interface OnboardingRequestsSectionProps {
    onRequestApproved?: () => void;
}

import { useSuperAdminCompanyStore } from '@/lib/zustand/superadmin/onboarding-request';

export function OnboardingRequestsSection({ onRequestApproved }: OnboardingRequestsSectionProps) {
    const { addToast } = useToast();
    const { requests, loading, error, fetchRequests, approveRequest, rejectRequest } = useSuperAdminCompanyStore();
    const [filter, setFilter] = useState<string>('all');

    // Modal states
    const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const filteredRequests = requests?.filter(req => filter === 'all' || req.status === filter) || [];


    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);


    const handleApprove = async () => {
        if (!selectedRequest) return;
        setActionLoading(true);
        try {
            await approveRequest(selectedRequest.id);
            addToast({ title: 'Approved!', description: 'Company and admin created successfully. Welcome email sent.', variant: 'success' });
            setIsApproveModalOpen(false);
            setIsDetailModalOpen(false);
            fetchRequests();
            onRequestApproved?.();
        } catch (error: any) {
            addToast({ title: 'Error', description: error.response?.data?.message || 'Failed to approve request', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        console.log("selectedRequest", selectedRequest);

        setActionLoading(true);
        try {
            await rejectRequest(selectedRequest.id, rejectionReason);
            addToast({ title: 'Rejected', description: 'Request rejected. Notification email sent to applicant.', variant: 'success' });
            setIsRejectModalOpen(false);
            setIsDetailModalOpen(false);
            setRejectionReason('');
            fetchRequests();
        } catch (error: any) {
            addToast({ title: 'Error', description: error.response?.data?.message || 'Failed to reject request', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 text-[10px]"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
            case 'approved':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
            case 'rejected':
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-[10px]"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
            default:
                return null;
        }
    };

    const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;

    return (
        <>
            {/* Section */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden p-4">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        Onboarding Requests
                        {pendingCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                                {pendingCount}
                            </span>
                        )}
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                            {['all', 'pending', 'approved', 'rejected'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 capitalize transition-colors ${filter === f
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => fetchRequests()} className="h-8 w-8 p-0">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3 font-medium">Company</th>
                                <th className="px-4 py-3 font-medium">Contact Person</th>
                                <th className="px-4 py-3 font-medium">Team Size</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Submitted</th>
                                <th className="px-4 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading && requests?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading requests...</td>
                                </tr>
                            ) : filteredRequests?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                        No {filter !== 'all' ? filter : ''} onboarding requests found.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests?.map((req: OnboardingRequest) => (
                                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-foreground">{req.company_name}</div>
                                            <div className="text-xs text-muted-foreground">{req.company_email}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-foreground">{req.contact_name}</div>
                                            <div className="text-xs text-muted-foreground">{req.contact_designation}</div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{req.team_size}</td>
                                        <td className="px-4 py-3">{statusBadge(req.status)}</td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => {
                                                        setSelectedRequest(req);
                                                        setIsDetailModalOpen(true);
                                                    }}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {req.status === 'pending' && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 text-xs"
                                                            onClick={() => {
                                                                setSelectedRequest(req);
                                                                setIsApproveModalOpen(true);
                                                            }}
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />

                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs"
                                                            onClick={() => {
                                                                setSelectedRequest(req);
                                                                setIsRejectModalOpen(true);
                                                            }}
                                                        >
                                                            <XCircle className="h-3.5 w-3.5 mr-1" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="sm:max-w-[600px] bg-background max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Request Details
                            {selectedRequest && statusBadge(selectedRequest.status)}
                        </DialogTitle>
                        <DialogDescription>
                            Submitted on {selectedRequest && new Date(selectedRequest.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="space-y-4 mt-2">
                            {/* Company Info */}
                            <div className="rounded-lg border border-border p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                    <Building2 className="h-4 w-4" /> Company Information
                                </h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-muted-foreground text-xs">Company Name</span>
                                        <p className="font-medium">{selectedRequest.company_name}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Email</span>
                                        <p className="font-medium">{selectedRequest.company_email}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Phone</span>
                                        <p className="font-medium">{selectedRequest.company_phone}</p>
                                    </div>
                                    {selectedRequest.company_website && (
                                        <div>
                                            <span className="text-muted-foreground text-xs flex items-center gap-1"><Globe className="h-3 w-3" />Website</span>
                                            <p className="font-medium">{selectedRequest.company_website}</p>
                                        </div>
                                    )}
                                    {selectedRequest.company_address && (
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />Address</span>
                                            <p className="font-medium">{selectedRequest.company_address}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contact Person */}
                            <div className="rounded-lg border border-border p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                    <User className="h-4 w-4" /> Contact Person (Future Admin)
                                </h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-muted-foreground text-xs">Full Name</span>
                                        <p className="font-medium">{selectedRequest.contact_name}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs flex items-center gap-1"><Briefcase className="h-3 w-3" />Designation</span>
                                        <p className="font-medium">{selectedRequest.contact_designation}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Email</span>
                                        <p className="font-medium">{selectedRequest.contact_email}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="h-3 w-3" />Phone</span>
                                        <p className="font-medium">{selectedRequest.contact_phone}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Team & Purpose */}
                            <div className="rounded-lg border border-border p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                                    <Target className="h-4 w-4" /> Team & Purpose
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="text-muted-foreground text-xs">Purpose</span>
                                        <p className="font-medium">{selectedRequest.purpose}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-muted-foreground text-xs">Team Size</span>
                                            <p className="font-medium">{selectedRequest.team_size} members</p>
                                        </div>
                                        {selectedRequest.industry && (
                                            <div>
                                                <span className="text-muted-foreground text-xs">Industry</span>
                                                <p className="font-medium">{selectedRequest.industry}</p>
                                            </div>
                                        )}
                                    </div>
                                    {selectedRequest.description && (
                                        <div>
                                            <span className="text-muted-foreground text-xs">Additional Notes</span>
                                            <p className="font-medium">{selectedRequest.description}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Rejection reason if rejected */}
                            {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900 p-4">
                                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-1">
                                        <XCircle className="h-4 w-4" /> Rejection Reason
                                    </h3>
                                    <p className="text-sm text-red-600 dark:text-red-300">{selectedRequest.rejection_reason}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        {selectedRequest?.status === 'pending' && (
                            <div className="flex gap-2 w-full">
                                <Button
                                    variant="outline"
                                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => {
                                        setIsDetailModalOpen(false);
                                        setIsRejectModalOpen(true);
                                    }}
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => {
                                        setIsDetailModalOpen(false);
                                        setIsApproveModalOpen(true);
                                    }}
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Approve
                                </Button>
                            </div>
                        )}
                        {selectedRequest?.status !== 'pending' && (
                            <DialogClose>
                                <Button variant="outline">Close</Button>
                            </DialogClose>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve Confirmation Modal */}
            <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
                <DialogContent className="sm:max-w-[440px] bg-background">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            Approve Request
                        </DialogTitle>
                        <DialogDescription>
                            This will create a company and admin account for <strong>{selectedRequest?.company_name}</strong>.
                            A welcome email with a temporary password will be sent to <strong>{selectedRequest?.contact_email}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                        ⚠️ This action cannot be undone. The admin user will be created immediately.
                    </div>

                    <DialogFooter className="pt-2">
                        <DialogClose>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleApprove} loading={actionLoading}>
                            {actionLoading ? 'Approving...' : 'Yes, Approve'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Modal */}
            <Dialog open={isRejectModalOpen} onOpenChange={(open) => {
                setIsRejectModalOpen(open);
                if (!open) setRejectionReason('');
            }}>
                <DialogContent className="sm:max-w-[440px] bg-background">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-600" />
                            Reject Request
                        </DialogTitle>
                        <DialogDescription>
                            Reject the registration request from <strong>{selectedRequest?.company_name}</strong>.
                            An email will be sent to <strong>{selectedRequest?.contact_email}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Rejection Reason</label>
                        <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Please provide a reason for rejection..."
                            className="min-h-[80px]"
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <DialogClose>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            onClick={handleReject}
                            loading={actionLoading}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {actionLoading ? 'Rejecting...' : 'Yes, Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
