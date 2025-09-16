import {
  Component,
  ViewChild,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from "@angular/core";
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from "@angular/forms";

// RxJS
import { Subject, takeUntil } from "rxjs";

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from "primeng/api";

// Services
import { RecordsService } from "../services/records.service";
import { GroupsService } from "../services/groups.service";
import { StockService } from "../services/stock.service";
import { CartService } from "../services/cart.service";
import { UserService } from "src/app/services/user.service";

// Interfaces
import { IRecord } from "../ecommerce.interface";

@Component({
  selector: "app-records",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    ConfirmDialogModule
  ],
  templateUrl: "./records.component.html",
  providers: [ConfirmationService],
})
export class RecordsComponent implements OnInit, OnDestroy {
  @ViewChild("form") form!: NgForm;
  @ViewChild("fileInput") fileInput!: ElementRef;
  visibleError = false;
  errorMessage = "";
  records: IRecord[] = [];
  filteredRecords: IRecord[] = [];
  visibleConfirm = false;
  imageRecord = "";
  visiblePhoto = false;
  photo = "";
  searchText: string = "";

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

  groups: any[] = [];
  recordService: any;
  private destroy$ = new Subject<void>();

  private recordsService = inject(RecordsService);
  private groupsService = inject(GroupsService);
  private confirmationService = inject(ConfirmationService);
  private stockService = inject(StockService);
  private cartService = inject(CartService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  

  // Add this new method to handle group selection changes
  onGroupChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (select.value === '') {
      this.record.groupId = null;
    }
  }

  ngOnInit(): void {
    this.getRecords();
    this.getGroups();
    
    // Initialize the form with a clean state
    this.resetForm();

    // Subscribe to stock updates
    this.stockService.stockUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        if (!update) return;
        
        const { recordId, newStock } = update;
        
        // Create new array references to trigger change detection
        this.records = this.records.map(record => 
          record.idRecord === recordId ? { ...record, stock: newStock } : record
        );
        
        this.filteredRecords = this.filteredRecords.map(record => 
          record.idRecord === recordId ? { ...record, stock: newStock } : record
        );
      });

    // Subscribe to cart updates
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe((cartItems) => {
        this.records.forEach((record) => {
          const cartItem = cartItems.find(
            (item) => item.idRecord === record.idRecord
          );
          record.inCart = !!cartItem;
          record.amount = cartItem ? cartItem.amount || 0 : 0;
        });
        this.filteredRecords = [...this.records];
      });
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  getRecords() {
    this.recordsService.getRecords().subscribe({
      next: (data: any) => {
        // Extract records array from response
        let recordsArray: any[] = [];
        if (Array.isArray(data)) {
          recordsArray = data;
        } else if (data && Array.isArray(data.$values)) {
          recordsArray = data.$values;
        } else if (data && Array.isArray(data.data)) {
          recordsArray = data.data;
        }
        
        // Initialize stock values in the stock service
        recordsArray.forEach(record => {
          if (record.idRecord && typeof record.stock === 'number') {
            this.stockService.updateStock(record.idRecord, record.stock);
          }
        });

        // Get the groups to assign names
        this.groupsService.getGroups().subscribe({
          next: (groupsResponse: any) => {
            let groups: any[] = [];
            if (Array.isArray(groupsResponse)) {
              groups = groupsResponse;
            } else if (groupsResponse && Array.isArray(groupsResponse.$values)) {
              groups = groupsResponse.$values;
            }

            // Assign the group name to each record
            const processedRecords = recordsArray.map((record: any) => {
              // Ensure required properties exist
              const processedRecord: IRecord = {
                idRecord: record.idRecord || 0,
                titleRecord: record.titleRecord || '',
                yearOfPublication: record.yearOfPublication || null,
                imageRecord: record.imageRecord || null,
                photo: record.photo || null,
                photoName: record.photoName || null,
                price: record.price || 0,
                stock: record.stock || 0,
                discontinued: record.discontinued || false,
                groupId: record.groupId || null,
                groupName: '',
                nameGroup: ''
              };
              
              // Find matching group and assign name
              if (processedRecord.groupId !== null) {
                const group = groups.find(g => g.idGroup === processedRecord.groupId);
                if (group) {
                  processedRecord.groupName = group.nameGroup || '';
                  processedRecord.nameGroup = group.nameGroup || '';
                }
              }
              
              return processedRecord;
            });

            this.records = processedRecords;
            this.filteredRecords = [...this.records];
            this.cdr.markForCheck(); // Trigger change detection
          },
          error: (err: any) => {
            console.error("Error getting groups:", err);
            this.records = recordsArray;
            this.filteredRecords = [...this.records];
            this.controlError(err);
            this.cdr.markForCheck(); // Trigger change detection
          },
        });
      },
      error: (err) => {
        console.error("Error getting records:", err);
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  filterRecords() {
    if (!this.searchText?.trim()) {
      this.filteredRecords = [...this.records];
      this.cdr.markForCheck(); // Trigger change detection
      return;
    }

    const searchTerm = this.searchText.toLowerCase();
    this.filteredRecords = this.records.filter((record) => {
      return (
        record.titleRecord?.toLowerCase().includes(searchTerm) ||
        record.groupName?.toLowerCase().includes(searchTerm) ||
        record.yearOfPublication?.toString().includes(searchTerm)
      );
    });
  }

  onSearchChange() {
    this.filterRecords();
    this.cdr.markForCheck(); // Trigger change detection
  }

  getGroups() {
    this.groupsService.getGroups().subscribe({
      next: (response: any) => {
        // Flexible handling of different response structures
        let groupsArray = [];

        if (Array.isArray(response)) {
          // The answer is a direct array
          groupsArray = response;
        } else if (Array.isArray(response.$values)) {
          // The response has property $values
          groupsArray = response.$values;
        } else if (Array.isArray(response.data)) {
          // The response has data property
          groupsArray = response.data;
        } else {
          console.warn("Unexpected API response structure:", response);
        }

        this.groups = groupsArray;
        this.cdr.markForCheck(); // Trigger change detection
      },
      error: (err) => {
        console.error("Error loading groups:", err);
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  onChange(event: any) {
    const file = event.target.files;

    if (file && file.length > 0) {
      this.record.photo = file[0];
      this.record.photoName = file[0].name;
    }
  }

  onAceptar() {
    this.fileInput.nativeElement.value = "";
  }

  showImage(record: IRecord) {
    if (this.visiblePhoto && this.record === record) {
      this.visiblePhoto = false;
    } else {
      this.record = record;
      this.photo = record.imageRecord!;
      this.visiblePhoto = true;
    }
  }

  save() {
    if (!this.record.titleRecord || !this.record.price || !this.record.stock) {
      this.visibleError = true;
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    // Create a copy of the record to avoid modifying the original
    const recordToSave = { ...this.record };

    // Ensure groupId is a number or null
    if (recordToSave.groupId === undefined) {
      recordToSave.groupId = null;
    }

    if (this.record.idRecord === 0) {
      this.recordsService.addRecord(recordToSave).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.resetForm();
          this.getRecords();
        },
        error: (err) => {
          console.error('Error adding record:', {
            error: err,
            errorDetails: err?.error,
            status: err?.status,
            statusText: err?.statusText,
            headers: err?.headers,
            url: err?.url
          });
          this.visibleError = true;
          this.controlError(err);
        },
      });
    } else {
      this.recordsService.updateRecord(recordToSave).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.resetForm();
          this.getRecords();
        },
        error: (err) => {
          console.error('Error updating record:', err);
          this.visibleError = true;
          this.controlError(err);
        },
      });
    }
  }

  confirmDelete(record: IRecord) {
    this.confirmationService.confirm({
      message: `Delete record ${record.titleRecord}?`,
      header: "Are you sure?",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Yes",
      acceptButtonStyleClass: "p-button-danger",
      accept: () => this.deleteRecord(record.idRecord),
    });
  }

  deleteRecord(id: number) {
    this.recordsService.deleteRecord(id).subscribe({
      next: (data: IRecord) => {
        this.visibleError = false;
        this.getRecords();
      },
      error: (err: any) => {
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  edit(record: IRecord) {
    this.record = { ...record };
    if (this.record.stock === null || this.record.stock === undefined) {
      this.record.stock = 1;
    }
    this.record.photoName = record.imageRecord
      ? this.extractImageName(record.imageRecord)
      : "";
    // If there is an associated group, make sure the select reflects it
    if (record.groupId) {
      const selectedGroup = this.groups.find(
        (g) => g.idGroup === record.groupId
      );
      if (selectedGroup) {
        this.record.groupName = selectedGroup.nameGroup;
      }
    }
  }

  extractImageName(url: string): string {
    return url.split("/").pop() || "";
  }

  // Reset the form to its initial state
  private resetForm() {
    this.record = {
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

    if (this.form) {
      this.form.resetForm();
      this.form.form.markAsPristine();
      this.form.form.markAsUntouched();
      this.cdr.detectChanges();
    }
  }

  cancelEdition() {
    this.resetForm();
  }

  controlError(err: any) {
    console.error('Error details:', err);
    
    // Handle HTTP errors
    if (err.status === 400) {
      if (err.error && typeof err.error === 'object') {
        // Handle validation errors
        if (err.error.errors) {
          const errorMessages = [];
          for (const key in err.error.errors) {
            if (err.error.errors[key]) {
              errorMessages.push(...err.error.errors[key]);
            }
          }
          this.errorMessage = errorMessages.join('\n');
          return;
        }
        // Handle custom error messages
        if (err.error.title) {
          this.errorMessage = err.error.title;
          return;
        }
      }
      this.errorMessage = 'Invalid data. Please check your input and try again.';
      return;
    }
    
    if (err.status === 401) {
      this.errorMessage = 'Unauthorized. Please log in again.';
      return;
    }
    
    if (err.status === 403) {
      this.errorMessage = 'You do not have permission to perform this action.';
      return;
    }
    
    if (err.status === 404) {
      this.errorMessage = 'The requested resource was not found.';
      return;
    }
    
    if (err.status >= 500) {
      this.errorMessage = 'A server error occurred. Please try again later.';
      return;
    }
    
    // Handle other types of errors
    if (err.error && typeof err.error === "object" && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === "string") {
      this.errorMessage = err.error;
    } else if (err.message) {
      this.errorMessage = err.message;
    } else {
      this.errorMessage = 'An unexpected error occurred. Please try again.';
    }
  }

  addToCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail) return;

    this.cartService.addToCart(record).subscribe(
      (response) => {
        // Update UI locally
        record.inCart = true;
        record.amount = (record.amount || 0) + 1;
        this.filteredRecords = [...this.records];
      },
      (error) => {
        console.error("Error adding to cart:", error);
        // Revert local changes if it fails
        record.inCart = false;
        record.amount = 0;
        this.filteredRecords = [...this.records];
      }
    );
  }

  removeFromCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail || !record.inCart) return;

    this.cartService.removeFromCart(record).subscribe(
      (response) => {
        // Update UI locally
        record.amount = Math.max(0, (record.amount || 0) - 1);
        record.inCart = record.amount > 0;
        this.filteredRecords = [...this.records];
      },
      (error) => {
        console.error("Error removing from cart:", error);
        // Revert local changes if it fails
        record.amount = (record.amount || 0) + 1;
        record.inCart = true;
        this.filteredRecords = [...this.records];
      }
    );
  }
}
