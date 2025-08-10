import { Component, OnDestroy, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { OrderService } from '../services/order.service';
import { Subject } from 'rxjs';
import { IOrder } from '../ecommerce.interface';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-admin-orders',
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DatePipe,
    DecimalPipe
  ]
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  orders: IOrder[] = [];
  filteredOrders: IOrder[] = [];
  loading = true;
  searchText: string = '';
  expandedOrderId: number | null = null;
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  private orderService = inject(OrderService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadAllOrders();
  }

  loadAllOrders(): void {
    this.loading = true;
    this.orderService.getAllOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.filteredOrders = [...orders];
        this.loading = false;
        this.cdr.markForCheck(); // Trigger change detection after loading orders
      },
      error: (err) => {
        console.error('Error loading all orders:', err);
        this.orders = [];
        this.filteredOrders = [];
        this.loading = false;
        this.cdr.markForCheck(); // Trigger change detection on error
      },
    });
  }

  toggleOrderDetails(orderId: number): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
    this.cdr.markForCheck(); // Trigger change detection after toggling order details
  }

  isOrderExpanded(orderId: number): boolean {
    return this.expandedOrderId === orderId;
  }

  onSearchChange() {
    this.filterOrders(this.searchText);
  }

  private filterOrders(searchText: string): void {
    if (!searchText) {
      this.filteredOrders = [...this.orders];
      this.cdr.markForCheck(); // Trigger change detection after filtering
      return;
    }

    const searchLower = searchText.toLowerCase();
    this.filteredOrders = this.orders.filter(
      (order) =>
        order.userEmail.toLowerCase().includes(searchLower) ||
        order.idOrder.toString().includes(searchLower) ||
        order.paymentMethod.toLowerCase().includes(searchLower) ||
        (order.orderDate &&
          new Date(order.orderDate).toLocaleDateString().includes(searchLower))
    );
    this.cdr.markForCheck(); // Trigger change detection after filtering
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }
}
