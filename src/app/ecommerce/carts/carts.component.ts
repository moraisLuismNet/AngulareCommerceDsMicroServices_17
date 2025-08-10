import { Component, OnInit, OnDestroy, effect, ChangeDetectorRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

// Services
import { UserService } from 'src/app/services/user.service';
import { CartService } from '../services/cart.service';

// Interfaces
import { ICart } from '../ecommerce.interface';

@Component({
  selector: 'app-carts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    DialogModule,
    ConfirmDialogModule,
    InputTextModule,
    ProgressSpinnerModule
  ],
  templateUrl: './carts.component.html',
  styleUrls: ['./carts.component.css']
})
export class CartsComponent implements OnInit, OnDestroy {
  carts: ICart[] = [];
  filteredCarts: ICart[] = [];
  loading = false;
  errorMessage = '';
  isAdmin = false;
  searchText: string = '';
  visibleError = false;

  private destroyRef = effect(() => {
    // Reactive effect that will run when dependencies change
    // This can be used for reactive state management
    return () => {
      // Cleanup function for the effect
    };
  });

  private userService = inject(UserService);
  private cartService = inject(CartService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {}

  ngOnInit(): void {
    // Initialize the component directly in ngOnInit
    this.isAdmin = this.userService.isAdmin();
    this.loadCarts();
  }

  loadCarts(): void {
    this.loading = true;
    
    const handleResponse = (data: any, isAdmin: boolean) => {
      try {
        if (isAdmin) {
          // For admin, handle the array of carts
          const receivedCarts = data.$values || data;
          this.carts = Array.isArray(receivedCarts) ? receivedCarts : [receivedCarts];
        } else {
          // For regular users, expect a single cart
          this.carts = Array.isArray(data) ? data : [data];
        }
        
        this.filteredCarts = [...this.carts];
      } catch (error) {
        console.error('Error processing cart data:', error);
        this.errorMessage = 'Error processing cart data';
        this.visibleError = true;
      } finally {
        this.loading = false;
        this.cdr.detectChanges();
      }
    };

    const handleError = (error: any, isAdmin: boolean) => {
      // Use setTimeout to defer the error handling
      setTimeout(() => {
        console.error('Error:', error);
        this.errorMessage = isAdmin ? 'Error loading carts' : 'Error loading your cart';
        this.visibleError = true;
        this.loading = false;
        this.cdr.markForCheck(); // Mark for check after error
      });
    };

    if (this.isAdmin) {
      this.cartService.getAllCarts().subscribe({
        next: (data: any) => handleResponse(data, true),
        error: (error) => handleError(error, true)
      });
    } else {
      const userEmail = this.userService.email;
      if (!userEmail) {
        this.errorMessage = 'No user logged in';
        this.visibleError = true;
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }

      this.cartService.getCart(userEmail).subscribe({
        next: (data) => handleResponse(data, false),
        error: (error) => handleError(error, false)
      });
    }
  }

  filterCarts() {
    // Use setTimeout to ensure this runs in the next change detection cycle
    Promise.resolve().then(() => {
      if (!this.searchText) {
        this.filteredCarts = [...this.carts];
      } else {
        this.filteredCarts = this.carts.filter((cart) =>
          cart.userEmail.toLowerCase().includes(this.searchText.toLowerCase())
        );
      }
      this.cdr.markForCheck();
    });
  }

  onSearchChange() {
    this.filterCarts();
  }

  // Method to navigate to details
  navigateToCartDetails(userEmail: string) {
    this.router.navigate(['/cart-details'], {
      queryParams: { email: userEmail },
    });
  }

  toggleCartStatus(email: string, enable: boolean): void {
    this.loading = true;

    const operation = enable
      ? this.cartService.enableCart(email)
      : this.cartService.disableCart(email);

    operation.subscribe({
      next: (updatedCart) => {
        // Use setTimeout to defer the update to the next change detection cycle
        setTimeout(() => {
          const cartIndex = this.carts.findIndex((c) => c.userEmail === email);
          if (cartIndex !== -1) {
            // Create a new array to trigger change detection
            this.carts = [
              ...this.carts.slice(0, cartIndex),
              {
                ...this.carts[cartIndex],
                enabled: enable,
                totalPrice: enable ? this.carts[cartIndex].totalPrice : 0,
              },
              ...this.carts.slice(cartIndex + 1)
            ];
            this.filterCarts(); // Refresh the filtered list
          }
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
      error: (error) => {
        // Use setTimeout to defer the error handling
        setTimeout(() => {
          console.error('Error toggling cart status:', error);
          this.errorMessage = `Error ${enable ? 'enabling' : 'disabling'} cart`;
          this.visibleError = true;
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  ngOnDestroy(): void {
    // Cleanup any subscriptions or resources
    // The destroyRef will automatically clean up the effect when the component is destroyed
  }
}
