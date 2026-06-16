'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useRouter } from 'next/navigation';
import { Users, Building, Plus, LogIn, LogOut, ClipboardList, Eye } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { StatsCard } from '@/components/shared-components/stats-card';
import { AddCompanyModal } from '@/components/superadmin/add-company-modal';
import api from '@/lib/api';
import { Company } from '@/lib/types/auth';
import CompanyDetailsModal from '@/components/superadmin/show-company-details';
import { OnboardingRequestsSection } from '@/components/superadmin/onboarding-requests';
import { NotificationBell } from '@/components/notifications/notification-bell';
import ProfileModal from '@/components/profile/profile-modal';
import { useSuperAdminCompanyStore } from '@/lib/zustand/superadmin/onboarding-request';
export default function Companies() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const { addToast } = useToast();


    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const { fetchCompanies, companies, loading, requests, fetchRequests } = useSuperAdminCompanyStore();

    // const fetchPendingCount = async () => {
    //     try {
    //         const res = await api.get('/superadmin/onboarding-requests?status=pending');
    //         setPendingRequestsCount(res.data.length);
    //     } catch (error) {
    //         console.error(error);
    //     }
    // };

    useEffect(() => {
        if (!isAuthenticated) { router.replace('/login'); return; }
        if (user?.platform_role !== 'superadmin') {
            router.replace('/dashboard/member');
            return;
        }
        fetchCompanies();
    }, [isAuthenticated, user, router]);

    return (
        <main className="p-4">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                        Global Platform
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">Manage tenant companies and platform administration</p>
                <p className="text-lg font-semibold text-foreground">Companies</p>

            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mt-4">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Building className="h-5 w-5 text-muted-foreground" />
                        Organizations
                    </h2>
                    {/* <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        New Company
                    </Button> */}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">

                            <tr>
                                <th className="px-4 py-3 font-medium">Company Name</th>
                                <th className="px-4 py-3 font-medium">Contact Email</th>
                                <th className="px-4 py-3 font-medium">Phone</th>
                                <th className="px-4 py-3 font-medium">Created On</th>
                                <th className="px-4 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading && companies.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading companies...</td>
                                </tr>
                            ) : companies.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No companies found on the platform.</td>
                                </tr>
                            ) : (
                                companies?.map(company => (
                                    <tr key={company.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            <div className="flex items-center gap-2">
                                                {company.name}
                                                {user?.company_id === company.id && (
                                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase tracking-wider">Your Company</Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{company.email || '-'}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{company.phone || '-'}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {new Date(company.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    router.push(`/dashboard/superadmin/companies/${company.id}/users`);
                                                }}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddCompanyModal
                open={isAddModalOpen}
                onOpenChange={setIsAddModalOpen}
                onSuccess={fetchCompanies}
            />

            {/* Company Modal */}
            <CompanyDetailsModal
                open={isCompanyModalOpen}
                onOpenChange={setIsCompanyModalOpen}
                company={selectedCompany}
            />

            {/* Onboarding Requests Section */}
            <div className="mt-6">
                <OnboardingRequestsSection
                    onRequestApproved={() => {
                        fetchCompanies();

                    }}
                />
            </div>

            <ProfileModal
                open={showProfileModal}
                onOpenChange={setShowProfileModal}
            />
        </main>
    );
}