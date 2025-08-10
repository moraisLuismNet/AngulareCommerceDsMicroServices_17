import { Component, OnDestroy, afterNextRender, afterRender, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// RxJS
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

// Services
import { OrderService } from '../services/order.service';
import { UserService } from 'src/app/services/user.service';

// Interfaces
import { IOrder } from '../ecommerce.interface';

@Component({
  selector: 'app-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule
  ],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnDestroy {
  orders: IOrder[] = [];
  filteredOrders: IOrder[] = [];
  loading = true;
  searchText: string = '';
  expandedOrderId: number | null = null;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  private orderService = inject(OrderService);
  private userService = inject(UserService);

  constructor() {
    // Use afterNextRender for one-time initialization after the component is created
    afterNextRender(() => {
      this.initializeComponent();
    });

    // Use afterRender for DOM-dependent operations
    afterRender(() => {
      // This will run after every change detection cycle
      // Can be used for DOM measurements or other operations that need the view to be stable
    });

    // Subscribe to email changes
    this.userService.emailUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(email => {
      if (email) {
        this.loadOrders(email);
      }
    });
  }

  private initializeComponent(): void {
    // Any additional initialization logic can go here
  }

  loadOrders(email: string): void {
    this.loading = true;
    this.orderService.getOrdersByUserEmail(email).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.filteredOrders = [...orders];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.orders = [];
        this.filteredOrders = [];
        this.loading = false;
      },
    });
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleOrderDetails(orderId: number): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
  }

  isOrderExpanded(orderId: number): boolean {
    return this.expandedOrderId === orderId;
  }

  filterOrders() {
    this.filteredOrders = this.orders.filter((order) =>
      order.orderDate.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  onSearchChange() {
    this.filterOrders();
  }
}
