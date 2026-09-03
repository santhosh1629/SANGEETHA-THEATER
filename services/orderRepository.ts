import { supabase, getStaffUnclaimedPendingOrders, getStaffMyPreparedOrders, claimOrderAsPreparing, markOrderAsReady, verifyQrCodeAndCollectOrder, getOrderById } from './mockApi';
import type { Order } from '../types';
import { OrderStatus as OrderStatusEnum } from '../types';

export interface StaffOrderState {
    unclaimedOrders: Order[];
    myPreparedOrders: Order[];
    loading: boolean;
    syncing: boolean;
    error: string | null;
    claimingIds: Set<string>;
    actionInProgressIds: Set<string>;
}

type StateListener = (state: StaffOrderState) => void;

class StaffOrderRepository {
    private state: StaffOrderState = {
        unclaimedOrders: [],
        myPreparedOrders: [],
        loading: true,
        syncing: false,
        error: null,
        claimingIds: new Set<string>(),
        actionInProgressIds: new Set<string>()
    };

    private listeners: Set<StateListener> = new Set();
    private activeStaffId: string | null = null;
    private realtimeChannel: any = null;
    private isInitialized = false;

    public getState(): StaffOrderState {
        return this.state;
    }

    public subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit() {
        // Clone state shallowly so subscribers detect changes
        const snapshot: StaffOrderState = {
            ...this.state,
            unclaimedOrders: [...this.state.unclaimedOrders],
            myPreparedOrders: [...this.state.myPreparedOrders],
            claimingIds: new Set(this.state.claimingIds),
            actionInProgressIds: new Set(this.state.actionInProgressIds)
        };
        this.listeners.forEach(l => l(snapshot));
    }

    /**
     * Initializes repository for the active staff member and establishes a single managed real-time subscription.
     */
    public initialize(staffId: string) {
        if (this.activeStaffId === staffId && this.isInitialized && this.realtimeChannel) {
            return;
        }

        this.activeStaffId = staffId;
        this.isInitialized = true;
        this.fetchOrders(true);
        this.setupRealtimeSubscription();
    }

    public async fetchOrders(isInitial = false) {
        if (!this.activeStaffId) return;

        if (isInitial) {
            this.state.loading = true;
        } else {
            this.state.syncing = true;
        }
        this.emit();

        try {
            const [unclaimed, myPrepared] = await Promise.all([
                getStaffUnclaimedPendingOrders(),
                getStaffMyPreparedOrders(this.activeStaffId)
            ]);

            this.state.unclaimedOrders = unclaimed;
            this.state.myPreparedOrders = myPrepared;
            this.state.error = null;
        } catch (err: any) {
            console.error("[StaffOrderRepository] Fetch error:", err);
            this.state.error = err.message || "Failed to load orders.";
        } finally {
            this.state.loading = false;
            this.state.syncing = false;
            this.emit();
        }
    }

    private setupRealtimeSubscription() {
        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }

        this.realtimeChannel = supabase
            .channel(`staff-orders-${this.activeStaffId || 'all'}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
                this.handleRealtimeEvent(payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log("[StaffOrderRepository] Realtime connected.");
                }
            });
    }

    /**
     * Optimized Diff/Merge for Realtime changes without full reload
     */
    private handleRealtimeEvent(payload: any) {
        const { eventType, new: newRow, old: oldRow } = payload;
        const currentStaffId = this.activeStaffId;

        if (eventType === 'INSERT') {
            const paymentStatus = (newRow.payment_status || '').toLowerCase();
            // If new paid order that is unclaimed
            if (paymentStatus === 'paid' && newRow.status === OrderStatusEnum.NEW && !newRow.prepared_by_id) {
                this.fetchOrders(false);
            }
        } else if (eventType === 'UPDATE') {
            const orderId = newRow.id;
            const status = newRow.status;
            const preparedById = newRow.prepared_by_id;

            // 1. If claimed by someone else or status is no longer NEW, remove from unclaimed
            if (preparedById || status !== OrderStatusEnum.NEW) {
                this.state.unclaimedOrders = this.state.unclaimedOrders.filter(o => o.id !== orderId);
            }

            // 2. If claimed by current staff
            if (preparedById === currentStaffId) {
                if (status === OrderStatusEnum.COLLECTED || status === OrderStatusEnum.CANCELLED) {
                    this.state.myPreparedOrders = this.state.myPreparedOrders.filter(o => o.id !== orderId);
                } else {
                    // Update in myPrepared list or add if not present
                    const existingIndex = this.state.myPreparedOrders.findIndex(o => o.id === orderId);
                    if (existingIndex >= 0) {
                        this.state.myPreparedOrders[existingIndex] = {
                            ...this.state.myPreparedOrders[existingIndex],
                            status: status as OrderStatusEnum,
                            preparedBy: preparedById,
                            preparedByName: newRow.prepared_by_name,
                            preparedAt: newRow.prepared_at ? new Date(newRow.prepared_at) : this.state.myPreparedOrders[existingIndex].preparedAt
                        };
                    } else if (status === OrderStatusEnum.PREPARING || status === OrderStatusEnum.READY) {
                        this.fetchOrders(false);
                        return;
                    }
                }
            } else {
                // If not claimed by current staff, ensure it's not in myPreparedOrders
                this.state.myPreparedOrders = this.state.myPreparedOrders.filter(o => o.id !== orderId);
            }

            this.emit();
        } else if (eventType === 'DELETE') {
            const orderId = oldRow.id;
            this.state.unclaimedOrders = this.state.unclaimedOrders.filter(o => o.id !== orderId);
            this.state.myPreparedOrders = this.state.myPreparedOrders.filter(o => o.id !== orderId);
            this.emit();
        }
    }

    /**
     * Atomic claim operation
     */
    public async claimOrder(orderId: string, staffId: string, staffName: string): Promise<Order> {
        // Prevent double click on same order
        if (this.state.claimingIds.has(orderId)) {
            throw new Error("Claim in progress. Please wait.");
        }

        this.state.claimingIds.add(orderId);
        this.emit();

        try {
            const updatedOrder = await claimOrderAsPreparing(orderId, staffId, staffName);

            // Update local state smoothly
            this.state.unclaimedOrders = this.state.unclaimedOrders.filter(o => o.id !== orderId);
            this.state.myPreparedOrders = [
                updatedOrder,
                ...this.state.myPreparedOrders.filter(o => o.id !== orderId)
            ];
            this.emit();
            return updatedOrder;
        } catch (error: any) {
            // Do NOT re-fetch all orders on error.
            // When user acknowledges "Already Prepared By Other", refreshSingleOrder will update only this order.
            throw error;
        } finally {
            this.state.claimingIds.delete(orderId);
            this.emit();
        }
    }

    /**
     * Refresh only a single order's state from the server without full list refetch
     */
    public async refreshSingleOrder(orderId: string): Promise<Order | null> {
        try {
            const freshOrder = await getOrderById(orderId);

            // If claimed by another staff member:
            if (freshOrder.preparedBy && freshOrder.preparedBy !== this.activeStaffId) {
                // Update in unclaimedOrders so that the card displays who actually prepared it
                const inUnclaimed = this.state.unclaimedOrders.some(o => o.id === orderId);
                if (inUnclaimed) {
                    this.state.unclaimedOrders = this.state.unclaimedOrders.map(o => o.id === orderId ? freshOrder : o);
                } else {
                    this.state.unclaimedOrders = [freshOrder, ...this.state.unclaimedOrders];
                }
                this.state.myPreparedOrders = this.state.myPreparedOrders.filter(o => o.id !== orderId);
            } else if (freshOrder.preparedBy === this.activeStaffId) {
                // Claimed by current staff
                this.state.unclaimedOrders = this.state.unclaimedOrders.filter(o => o.id !== orderId);
                const inMyPrepared = this.state.myPreparedOrders.some(o => o.id === orderId);
                if (inMyPrepared) {
                    this.state.myPreparedOrders = this.state.myPreparedOrders.map(o => o.id === orderId ? freshOrder : o);
                } else {
                    this.state.myPreparedOrders = [freshOrder, ...this.state.myPreparedOrders];
                }
            } else if (freshOrder.status === OrderStatusEnum.NEW && !freshOrder.preparedBy) {
                // Still truly unclaimed
                const inUnclaimed = this.state.unclaimedOrders.some(o => o.id === orderId);
                if (inUnclaimed) {
                    this.state.unclaimedOrders = this.state.unclaimedOrders.map(o => o.id === orderId ? freshOrder : o);
                } else {
                    this.state.unclaimedOrders = [freshOrder, ...this.state.unclaimedOrders];
                }
            } else {
                // Any other status
                this.state.unclaimedOrders = this.state.unclaimedOrders.filter(o => o.id !== orderId);
                this.state.myPreparedOrders = this.state.myPreparedOrders.filter(o => o.id !== orderId);
            }

            this.emit();
            return freshOrder;
        } catch (err) {
            console.error("Failed to refresh single order:", err);
            return null;
        }
    }

    /**
     * Mark order as READY
     */
    public async markReady(orderId: string, staffId: string): Promise<Order> {
        if (this.state.actionInProgressIds.has(orderId)) {
            throw new Error("Action in progress.");
        }

        this.state.actionInProgressIds.add(orderId);
        this.emit();

        try {
            const updatedOrder = await markOrderAsReady(orderId, staffId);
            this.state.myPreparedOrders = this.state.myPreparedOrders.map(o => 
                o.id === orderId ? { ...o, status: OrderStatusEnum.READY } : o
            );
            this.emit();
            return updatedOrder;
        } catch (error: any) {
            this.fetchOrders(false);
            throw error;
        } finally {
            this.state.actionInProgressIds.delete(orderId);
            this.emit();
        }
    }

    /**
     * QR Scan collection verification
     */
    public async verifyAndCollect(qrToken: string, staffId: string): Promise<Order> {
        const order = await verifyQrCodeAndCollectOrder(qrToken, staffId);
        // Remove from local list as it is now collected
        this.state.myPreparedOrders = this.state.myPreparedOrders.filter(o => o.id !== order.id);
        this.state.unclaimedOrders = this.state.unclaimedOrders.filter(o => o.id !== order.id);
        this.emit();
        return order;
    }

    public cleanup() {
        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
        this.listeners.clear();
        this.isInitialized = false;
    }
}

export const staffOrderRepository = new StaffOrderRepository();
