import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Company } from '@/lib/types/auth';
import api from '@/lib/api';
import { Users, FolderGit2, Boxes, CheckSquare } from 'lucide-react';

interface ExtendedCompany extends Company {
    stats?: {
        totalUsers: number;
        totalTasks: number;
        totalInstances: number;
        totalTemplates: number;
    }
}

interface CompanyDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    company: Company | null;
}

export default function CompanyDetailsModal({ open, onOpenChange, company }: CompanyDetailsModalProps) {
    const [details, setDetails] = useState<ExtendedCompany | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchComapnyDetails = async (companyId: string) => {
        try {
            setLoading(true);
            const res = await api.get(`/superadmin/company/details/${companyId}`);
            setDetails(res.data);
        } catch (error) {
            console.error("Failed to fetch company details", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (open && company?.id) {
            fetchComapnyDetails(company.id);
        } else if (!open) {
            // Reset state when closed
            setDetails(null);
        }
    }, [open, company])

    if (!company) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] bg-background">
                <DialogHeader>
                    <DialogTitle>Company Details - <span className='text-xl text-primary'>{company.name}</span></DialogTitle>
                    <DialogDescription>View and manage company details and statistics.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">

                    {/* Stats Section */}
                    {details?.stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div 
                                onClick={() => {
                                    onOpenChange(false); // Close the modal first
                                    window.location.href = `/dashboard/superadmin/companies/${company.id}/users`;
                                }}
                                className="flex flex-col items-center justify-center p-4 bg-primary/5 rounded-xl border border-primary/20 shadow-sm transition-transform hover:scale-105 cursor-pointer hover:bg-primary/10"
                                title="Click to view all users"
                            >
                                <Users className="h-6 w-6 text-primary mb-2" />
                                <span className="text-3xl font-bold text-foreground">{details.stats.totalUsers}</span>
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mt-1">Users</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 bg-primary/5 rounded-xl border border-primary/20 shadow-sm transition-transform hover:scale-105">
                                <CheckSquare className="h-6 w-6 text-primary mb-2" />
                                <span className="text-3xl font-bold text-foreground">{details.stats.totalTasks}</span>
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mt-1">Tasks</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 bg-primary/5 rounded-xl border border-primary/20 shadow-sm transition-transform hover:scale-105">
                                <Boxes className="h-6 w-6 text-primary mb-2" />
                                <span className="text-3xl font-bold text-foreground">{details.stats.totalInstances}</span>
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mt-1">Instances</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 bg-primary/5 rounded-xl border border-primary/20 shadow-sm transition-transform hover:scale-105">
                                <FolderGit2 className="h-6 w-6 text-primary mb-2" />
                                <span className="text-3xl font-bold text-foreground">{details.stats.totalTemplates}</span>
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mt-1">Templates</span>
                            </div>
                        </div>
                    )}

                    {loading && !details?.stats && (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    )}

                    {/* Company Info Section */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-4 border-t mt-2">
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</p>
                            <p className="text-sm font-medium text-foreground">{company.email || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Phone</p>
                            <p className="text-sm font-medium text-foreground">{company.phone || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Address</p>
                            <p className="text-sm font-medium text-foreground">{company?.address || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Website</p>
                            <p className="text-sm font-medium text-foreground">
                                {company?.website ? (
                                    <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline transition-colors">
                                        {company.website}
                                    </a>
                                ) : 'N/A'}
                            </p>
                        </div>
                        <div className="col-span-2 space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Description</p>
                            <p className="text-sm text-foreground bg-muted/40 p-4 rounded-lg border text-balance leading-relaxed">
                                {company?.description || 'No description provided.'}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
