import { Component, OnDestroy, afterNextRender, afterRender, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// RxJS
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

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
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './orders.component.html'
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
  private cdr = inject(ChangeDetectorRef);

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
    console.log('Loading orders for email:', email);
    
    this.orderService.getOrdersByUserEmail(email).subscribe({
      next: (orders) => {
        console.log('Raw orders data from API:', JSON.parse(JSON.stringify(orders)));
        
        // Ensure orders is an array
        const ordersArray = Array.isArray(orders) ? orders : [];
        
        // Log each order's structure
        ordersArray.forEach((order, index) => {
          console.log(`Order ${index + 1}:`, {
            idOrder: order.idOrder,
            orderDate: order.orderDate,
            paymentMethod: order.paymentMethod,
            total: order.total,
            userEmail: order.userEmail,
            orderDetailsCount: order.orderDetails ? (Array.isArray(order.orderDetails) ? order.orderDetails.length : 'Not an array') : 'No orderDetails',
            orderDetailsType: typeof order.orderDetails
          });
        });
        
        this.orders = ordersArray;
        this.filteredOrders = [...ordersArray];
        
        console.log('Processed orders:', this.orders);
        console.log('Filtered orders:', this.filteredOrders);
        
        this.loading = false;
        this.cdr.detectChanges(); // Force change detection
      },
      error: (err) => {
        console.error('Error loading orders:', {
          error: err,
          status: err?.status,
          message: err?.message,
          url: err?.url
        });
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
    if (!this.searchText || this.searchText.trim() === '') {
      this.filteredOrders = [...this.orders];
      return;
    }
    
    const searchTerm = this.searchText.toLowerCase().trim();
    this.filteredOrders = this.orders.filter(order => {
      // Buscar por fecha
      const orderDate = new Date(order.orderDate).toLocaleDateString().toLowerCase();
      // Buscar por método de pago
      const paymentMethod = order.paymentMethod?.toLowerCase() || '';
      // Buscar por monto total
      const total = order.total?.toString() || '';
      
      return orderDate.includes(searchTerm) || 
             paymentMethod.includes(searchTerm) ||
             total.includes(searchTerm);
    });
    
  }

  onSearchChange() {
    this.filterOrders();
  }
}
