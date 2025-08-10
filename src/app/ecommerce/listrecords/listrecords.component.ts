import { Component, OnDestroy, ViewChild, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from "@angular/router";

// RxJS
import { Subject, of, throwError } from "rxjs";
import {
  takeUntil,
  finalize,
  switchMap,
  map,
  catchError,
  tap
} from "rxjs/operators";

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from "primeng/api";

// Modules
import { SharedModule } from '../../shared/shared.module';

// Services
import { RecordsService } from "../services/records.service";
import { GroupsService } from "../services/groups.service";
import { CartService } from "src/app/ecommerce/services/cart.service";
import { CartDetailService } from "../services/cart-detail.service";
import { UserService } from "src/app/services/user.service";
import { StockService } from "../services/stock.service";
import { AuthGuard } from "src/app/guards/auth-guard.service";

// Interfaces
import { IRecord } from "../ecommerce.interface";

@Component({
  selector: "app-listrecords",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    ButtonModule,
    DialogModule,
    ConfirmDialogModule,
    SharedModule
  ],
  templateUrl: "./listrecords.component.html",
  styleUrls: ["./listrecords.component.css"],
  providers: [ConfirmationService],
})
export class ListrecordsComponent implements OnInit, OnDestroy {
  @ViewChild('navbar', { static: false }) navbar: any; // Using 'any' type to avoid circular dependency
  records: IRecord[] = [];
  filteredRecords: IRecord[] = [];
  searchText: string = "";
  cart: IRecord[] = [];
  groupId: string | null = null;
  groupName: string = "";
  errorMessage: string = "";
  visibleError: boolean = false;
  visiblePhoto: boolean = false;
  photo: string = "";
  cartItemsCount: number = 0;
  isAddingToCart = false;
  private readonly destroy$ = new Subject<void>();
  loading: boolean = false;
  cartEnabled: boolean = false;

  record: IRecord = {
    idRecord: 0,
    titleRecord: "",
    yearOfPublication: null,
    imageRecord: null,
    photo: null,
    photoName: null,
    price: 0,
    stock: 0,
    discontinued: false,
    groupId: null,
    groupName: "",
    nameGroup: "",
  };
  userEmail: string | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private recordsService = inject(RecordsService);
  private groupsService = inject(GroupsService);
  private cartService = inject(CartService);
  private cartDetailService = inject(CartDetailService);
  private userService = inject(UserService);
  private stockService = inject(StockService);
  private authGuard = inject(AuthGuard);
  private confirmationService = inject(ConfirmationService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const idGroup = params.get("idGroup");
      if (idGroup) {
        this.groupId = idGroup;
        this.loadRecords(idGroup);
      } else {
        this.errorMessage = "No group ID provided";
        this.visibleError = true;
      }
    });

    // Only configure subscriptions if the user is authenticated
    if (this.authGuard.isLoggedIn()) {
      this.setupSubscriptions();
      this.userEmail = this.authGuard.getUser();
      this.checkCartStatus();
    }
  }

  checkCartStatus() {
    // Enable cart by default
    this.cartEnabled = true;
    
    // If no user email, we can't check the cart status
    if (!this.userEmail) {
      return;
    }

    // Check cart status from the backend
    this.cartService.getCartStatus(this.userEmail).subscribe({
      next: (status) => {
        // Only disable if explicitly set to false in the backend
        this.cartEnabled = status.enabled !== false;
        this.cdr.markForCheck(); // Trigger change detection
      },
      error: (error) => {
        console.error("Error checking cart status:", error);
        // On error, keep the cart enabled by default
        this.cartEnabled = true;
        this.cdr.markForCheck(); // Trigger change detection
      },
    });
  }

  private setupSubscriptions(): void {
    // Subscribe to cart changes
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe((cartItems) => {
        // Update cart status for all records
        [this.records, this.filteredRecords].forEach((recordArray) => {
          recordArray.forEach((record) => {
            const cartItem = cartItems.find(
              (item: IRecord) => item.idRecord === record.idRecord
            );
            if (cartItem) {
              record.amount = cartItem.amount;
            } else {
              record.amount = 0;
            }
            // Ensure stock is up to date from the stock service
          });

          // Trigger change detection by creating new array references
          if (recordArray.length > 0) {
            if (recordArray === this.records) {
              this.records = [...this.records];
            } else {
              this.filteredRecords = [...this.filteredRecords];
            }
          }
        });
      });

    // Subscribe to stock updates
    this.stockService.stockUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        if (!update) return;
        
        const { recordId, newStock } = update;
        
        // Update records array
        this.records = this.records.map((record) => 
          record.idRecord === recordId 
            ? { ...record, stock: newStock }
            : record
        );
        
        // Update filtered records
        this.filteredRecords = this.filteredRecords.map((record) => 
          record.idRecord === recordId 
            ? { ...record, stock: newStock }
            : record
        );
      });

    // Subscribe to cart item count
    this.cartService.cartItemCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.cartItemsCount = count;
      });

    // Subscribe to user email changes
    this.userService.emailUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((email) => {
        this.userEmail = email;
      });
  }

  confirm(): void {
    this.confirmationService.confirm({
      message: "Are you sure you want to continue?",
      accept: () => {},
    });
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem("user");
  }

  loadRecords(idGroup: string): void {
    this.loading = true;
    this.errorMessage = "";
    this.visibleError = false;

    // First we synchronize the cart with the backend
    if (this.userEmail) {
      this.cartService.syncCartWithBackend(this.userEmail);
    }

    // Clear any existing stock data to ensure fresh state
    this.records = [];
    this.filteredRecords = [];

    this.recordsService
      .getRecordsByGroup(idGroup)
      .pipe(
        tap((records: IRecord[]) => {
          // Initialize stock values in the stock service
          if (records && records.length > 0) {
            records.forEach(record => {
              if (record.idRecord && typeof record.stock === 'number') {
                this.stockService.updateStock(record.idRecord, record.stock);
              }
            });
          }
        }),
        switchMap((records: IRecord[]) => {
          if (!records || records.length === 0) {
            this.errorMessage = "No records found for this group";
            this.visibleError = true;
            return of([]);
          }

          this.records = records;
          // Get cart items to sync cart status
          return this.cartService.getCartItems().pipe(
            map((cartItems: IRecord[]) => {
              // Update cart status for each record
              this.records.forEach((record) => {
                const cartItem = cartItems.find(
                  (item) => item.idRecord === record.idRecord
                );
                if (cartItem) {
                  record.inCart = true;
                  record.amount = cartItem.amount;
                } else {
                  record.inCart = false;
                  record.amount = 0;
                }
              });
              return this.records;
            })
          );
        }),
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck(); // Trigger change detection after loading records
        })
      )
      .subscribe({
        next: (records: IRecord[]) => {
          this.getGroupName(idGroup);
          this.filterRecords();
          this.cdr.markForCheck(); // Trigger change detection after loading records
        },
        error: (error) => {
          console.error("Error loading records:", error);
          this.errorMessage = "Error loading records";
          this.visibleError = true;
          this.cdr.markForCheck(); // Trigger change detection on error
        },
      });
  }

  getGroupName(idGroup: string): void {
    this.groupsService
      .getGroupName(idGroup)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (nameGroup: string) => {
          this.groupName = nameGroup;
        },
        error: (error) => {
          console.error("Error loading group name:", error);
          this.errorMessage = "Error loading group name";
          this.visibleError = true;
        },
      });
  }

  filterRecords(): void {
    if (!this.searchText) {
      this.filteredRecords = [...this.records];
      this.cdr.markForCheck(); // Trigger change detection after filtering
    } else {
      this.filteredRecords = this.records.filter((record) => {
        return (
          record.groupName
            .toLowerCase()
            .includes(this.searchText.toLowerCase()) ||
          record.titleRecord
            .toLowerCase()
            .includes(this.searchText.toLowerCase()) ||
          (record.yearOfPublication
            ? record.yearOfPublication.toString().includes(this.searchText)
            : false)
        );
      });
    }
  }

  onSearchChange(): void {
    this.filterRecords();
    this.cdr.markForCheck(); // Trigger change detection after search change
  }

  showImage(record: IRecord): void {
    if (this.visiblePhoto && this.record === record) {
      this.visiblePhoto = false;
    } else {
      this.record = record;
      this.photo = record.imageRecord!;
      this.visiblePhoto = true;
    }
    this.cdr.markForCheck(); // Trigger change detection after showing/hiding image
  }

  addToCart(record: IRecord): void {
    if (this.isAddingToCart || !record.stock || record.stock <= 0) {
      return;
    }

    this.isAddingToCart = true;
    this.errorMessage = "";
    this.visibleError = false;

    // Update stock locally first for immediate response
    const updatedRecords = this.records.map(r => 
      r.idRecord === record.idRecord 
        ? { ...r, stock: r.stock - 1 } 
        : r
    );
    
    const updatedFilteredRecords = this.filteredRecords.map(r => 
      r.idRecord === record.idRecord 
        ? { ...r, stock: r.stock - 1 } 
        : r
    );
    
    this.records = updatedRecords;
    this.filteredRecords = updatedFilteredRecords;

    this.cartService
      .addToCart(record)
      .pipe(
        finalize(() => (this.isAddingToCart = false)),
        catchError(error => {
          // Revert changes if there is an error
          const revertedRecords = this.records.map(r => 
            r.idRecord === record.idRecord 
              ? { ...r, stock: r.stock + 1 } 
              : r
          );
          
          this.records = revertedRecords;
          this.filteredRecords = revertedRecords;
          
          this.errorMessage = error.message || "Error adding to cart";
          this.visibleError = true;
          console.error("Error adding to cart:", error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (updatedRecord) => {
          // The stock has already been updated locally
          // If the server returns a different stock, we update it
          if (updatedRecord && updatedRecord.stock !== undefined) {
            this.records = this.records.map(r => 
              r.idRecord === record.idRecord 
                ? { ...r, stock: updatedRecord.stock } 
                : r
            );
            
            this.filteredRecords = this.filteredRecords.map(r => 
              r.idRecord === record.idRecord 
                ? { ...r, stock: updatedRecord.stock } 
                : r
            );
          }
        }
      });
  }

  removeRecord(record: IRecord): void {
    if (!record.amount || this.isAddingToCart) return;
    this.isAddingToCart = true;
    
    // Save the previous state so you can revert if necessary
    const prevAmount = record.amount;
    
    // Update locally first for immediate response
    const updatedRecords = this.records.map(r => 
      r.idRecord === record.idRecord 
        ? { 
            ...r, 
            amount: Math.max(0, prevAmount - 1),
            stock: (r.stock || 0) + 1 // Increase stock locally
          } 
        : r
    );
    
    this.records = updatedRecords;
    this.filteredRecords = this.filteredRecords.map(r => 
      r.idRecord === record.idRecord 
        ? { 
            ...r, 
            amount: Math.max(0, prevAmount - 1),
            stock: (r.stock || 0) + 1 // Increase stock locally
          } 
        : r
    );

    this.cartService
      .removeFromCart(record)
      .pipe(
        finalize(() => {
          this.isAddingToCart = false;
        }),
        catchError((error) => {
          // Revert local changes if there is an error
          this.records = this.records.map(r => 
            r.idRecord === record.idRecord 
              ? { 
                  ...r, 
                  amount: prevAmount,
                  stock: (r.stock || 0) - 1 // Reverse stock change
                } 
              : r
          );
          
          this.filteredRecords = this.filteredRecords.map(r => 
            r.idRecord === record.idRecord 
              ? { 
                  ...r, 
                  amount: prevAmount,
                  stock: (r.stock || 0) - 1 // Reverse stock change
                } 
              : r
          );
          
          this.errorMessage = error.message || "Error removing from cart";
          this.visibleError = true;
          console.error("Error removing from cart:", error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (updatedRecord) => {
          // The stock has already been updated locally
          // If the server returns a different stock, we update it
          if (updatedRecord && updatedRecord.stock !== undefined) {
            this.records = this.records.map(r => 
              r.idRecord === record.idRecord 
                ? { ...r, stock: updatedRecord.stock } 
                : r
            );
            
            this.filteredRecords = this.filteredRecords.map(r => 
              r.idRecord === record.idRecord 
                ? { ...r, stock: updatedRecord.stock } 
                : r
            );
          }
          
          // Synchronize the cart with the backend
          if (this.userEmail) {
            this.cartService.syncCartWithBackend(this.userEmail);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isAdmin(): boolean {
    return this.userService.isAdmin();
  }
}
