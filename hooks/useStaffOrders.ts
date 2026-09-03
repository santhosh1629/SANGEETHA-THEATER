import { useState, useEffect, useCallback, useMemo } from 'react';
import { staffOrderRepository, StaffOrderState } from '../services/orderRepository';
import type { Order } from '../types';
import { OrderStatus } from '../types';

export interface UseStaffOrdersResult {
    unclaimedOrders: Order[];
    myPreparedOrders: Order[];
    loading: boolean;
    syncing: boolean;
    error: string | null;
    claimingIds: Set<string>;
    actionInProgressIds: Set<string>;
    claimOrder: (orderId: string) => Promise<Order>;
    markReady: (orderId: string) => Promise<Order>;
    refreshOrders: () => Promise<void>;
    refreshSingleOrder: (orderId: string) => Promise<Order | null>;
}

export const useStaffOrders = (staffId: string, staffName: string): UseStaffOrdersResult => {
    const [state, setState] = useState<StaffOrderState>(() => staffOrderRepository.getState());

    useEffect(() => {
        if (!staffId) return;

        staffOrderRepository.initialize(staffId);
        const unsubscribe = staffOrderRepository.subscribe((newState) => {
            setState(newState);
        });

        return () => {
            unsubscribe();
        };
    }, [staffId]);

    const claimOrder = useCallback(async (orderId: string): Promise<Order> => {
        if (!staffId) throw new Error("Staff identity missing.");
        return await staffOrderRepository.claimOrder(orderId, staffId, staffName);
    }, [staffId, staffName]);

    const markReady = useCallback(async (orderId: string): Promise<Order> => {
        if (!staffId) throw new Error("Staff identity missing.");
        return await staffOrderRepository.markReady(orderId, staffId);
    }, [staffId]);

    const refreshOrders = useCallback(async (): Promise<void> => {
        await staffOrderRepository.fetchOrders(false);
    }, []);

    const refreshSingleOrder = useCallback(async (orderId: string): Promise<Order | null> => {
        return await staffOrderRepository.refreshSingleOrder(orderId);
    }, []);

    return {
        unclaimedOrders: state.unclaimedOrders,
        myPreparedOrders: state.myPreparedOrders,
        loading: state.loading,
        syncing: state.syncing,
        error: state.error,
        claimingIds: state.claimingIds,
        actionInProgressIds: state.actionInProgressIds,
        claimOrder,
        markReady,
        refreshOrders,
        refreshSingleOrder
    };
};
