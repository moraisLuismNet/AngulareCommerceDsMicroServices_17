import { Component, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, afterNextRender, afterRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { of, Subject } from 'rxjs';
import { takeUntil, filter, switchMap, tap } from 'rxjs/operators';

// PrimeNG Modules
import { BadgeModule } from 'primeng/badge';

// Services
import { UserService } from 'src/app/services/user.service';
import { CartService } from 'src/app/ecommerce/services/cart.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeModule
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent implements OnDestroy {
  emailUser: string | null = null;
  role: string | null = null;
  cartItemsCount: number = 0;
  cartTotal: number = 0;
  currentRoute: string = '';
  private readonly destroy$ = new Subject<void>();
  cartEnabled: boolean = true;

  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // Initialize the current route
    this.currentRoute = this.router.url;

    // Use afterNextRender for one-time initialization after the component is created
    afterNextRender(() => {
      this.setupSubscriptions();
    });

    // Use afterRender for DOM-dependent operations
    afterRender(() => {
      // This will run after every change detection cycle
      // Can be used for DOM measurements or other operations that need the view to be stable
    });
  }

  private setupSubscriptions(): void {
    // Combine multiple subscriptions to minimize change detection cycles
    this.userService.emailUser$
      .pipe(
        takeUntil(this.destroy$),
        tap((email) => {
          this.emailUser = email;
          if (!email) {
            this.cartItemsCount = 0;
            this.cartTotal = 0;
            this.role = null;
          }
        }),
        switchMap((email) => {
          if (email) {
            // Check cart status and then sync
            return this.cartService.getCartStatus(email).pipe(
              tap((status: { enabled: boolean }) => {
                this.cartEnabled = status.enabled;
                if (status.enabled) {
                  this.cartService.syncCartWithBackend(email);
                } else {
                  this.cartService.resetCart();
                }
              })
            );
          }
          return of(null);
        })
      )
      .subscribe();

    // Get initial role
    this.userService.role$
      .pipe(takeUntil(this.destroy$))
      .subscribe(role => {
        this.role = role;
        this.cdr.markForCheck();
      });

    // Subscription to cart item count with change detection
    this.cartService.cartItemCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.cartItemsCount = count;
        this.cdr.markForCheck();
      });

    // Subscription to cart total with change detection
    this.cartService.cartTotal$
      .pipe(
        takeUntil(this.destroy$),
      )
      .subscribe((total) => {
        this.cartTotal = total;
      });
    
    // Subscription to router events
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        this.currentRoute = event.url;
      });
  }

  isAdmin(): boolean {
    return this.role === 'Admin';
  }

  isListGroupsPage(): boolean {
    // Only hide the link when already on the listgroups page
    return this.currentRoute.includes('/listgroups');
  }

  isOrdersPage(): boolean {
    const isOrdersPage = this.currentRoute.includes('/ecommerce/admin-orders') || this.currentRoute.includes('/orders');
    return isOrdersPage;
  }

  isGenresPage(): boolean {
    return this.currentRoute.includes('/ecommerce/genres') || this.currentRoute === '/genres';
  }

  isGroupsPage(): boolean {
    return this.currentRoute.includes('/ecommerce/groups') || this.currentRoute === '/groups';
  }

  isRecordsPage(): boolean {
    return this.currentRoute.includes('/ecommerce/records') || this.currentRoute === '/records';
  }

  isCartsPage(): boolean {
    return this.currentRoute.includes('/ecommerce/carts') || this.currentRoute === '/carts';
  }

  isUsersPage(): boolean {
    return this.currentRoute.includes('/ecommerce/users') || this.currentRoute === '/users';
  }

  logout(): void {
    this.cartService.resetCart();
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('role');
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.emailUser = null;
    this.role = null;
  }

  isLoginPage(): boolean {
    return this.currentRoute === '/login' || this.currentRoute.includes('/login');
  }
}
