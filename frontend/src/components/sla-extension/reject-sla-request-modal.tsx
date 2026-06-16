'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSLAExtensionStore } from '@/lib/zustand/sla-extension/sla-extension';
import { useToastStore } from '@/lib/zustand/toast-store';
import { XCircle, AlertTriangle } from 'lucide-react';

interface RejectSLARequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
    onSuccess?: () => void;
}

export default function RejectSLARequestModal({
    isOpen,
    onClose,
    request,
    onSuccess
}: RejectSLARequestModalProps) {
    const [comment, setComment] = useState('');
    const { rejectRequest, loading } = useSLAExtensionStore();
    const { addToast } = useToastStore();

    const handleReject = async () => {
        if (comment.trim().length < 10) {
            addToast({
                title: 'Rejection comment must be at least 10 characters',
                variant: 'destructive'
            });
            return;
        }

        const success = await rejectRequest(request.id, comment.trim());

        if (success) {
            addToast({
                title: 'SLA extension request rejected',
                variant: 'success'
            });
            onClose();
            onSuccess?.();
        } else {
            addToast({
                title: useSLAExtensionStore.getState().error || 'Failed to reject request',
                variant: 'destructive'
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <DialogTitle>Reject SLA Extension Request</DialogTitle>
                            <DialogDescription className="mt-0.5">
                                {request.tasks?.title}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                        {/* Warning */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-yellow-900">
                                <p className="font-medium">Are you sure you want to reject this request?</p>
                                <p className="mt-1">
                                    The team member will be notified and expected to complete the task with the
                                    current deadline.
                                </p>
                            </div>
                        </div>

                        {/* Member's Request */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs font-medium text-gray-500 mb-2">MEMBER'S REASON</p>
                            <p className="text-sm text-gray-700">{request.reason}</p>
                            <p className="text-xs text-gray-500 mt-2">
                                Requested by: {request.requested_by_user?.name}
                            </p>
                        </div>

                        {/* Rejection Comment */}
                        <div>
                            <Label className="text-sm font-medium text-gray-700">
                                Reason for Rejection <span className="text-red-500">*</span>
                                <span className="text-xs text-gray-500 ml-2">(min 10 characters)</span>
                            </Label>
                            <Textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="E.g., Not a valid reason, please prioritize this task, insufficient justification..."
                                rows={4}
                                className="mt-2"
                                maxLength={300}
                            />
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-gray-500">
                                    {comment.length}/300 characters
                                </p>
                                {comment.length > 0 && comment.length < 10 && (
                                    <p className="text-xs text-red-500">
                                        {10 - comment.length} more characters needed
                                    </p>
                                )}
                            </div>
                        </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleReject}
                        disabled={loading || comment.trim().length < 10}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {loading ? 'Rejecting...' : 'Reject Request'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
