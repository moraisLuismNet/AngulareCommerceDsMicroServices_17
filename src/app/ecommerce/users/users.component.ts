import { Component, OnDestroy, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

// Services
import { UsersService } from "../services/users.service";

// Interfaces
import { IUser } from "../ecommerce.interface";

@Component({
  selector: "app-users",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    ConfirmDialogModule,
    TooltipModule
  ],
  templateUrl: "./users.component.html",
  styleUrls: ["./users.component.css"],
  providers: [ConfirmationService, MessageService]
})
export class UsersComponent implements OnInit, OnDestroy {
  users: IUser[] = [];
  filteredUsers: IUser[] = [];
  loading = true;
  searchText = "";
  errorMessage = "";
  visibleError = false;

  private usersService = inject(UsersService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.usersService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.filteredUsers = [...this.users];
        this.loading = false;
        this.cdr.markForCheck(); // Trigger change detection after loading users
      },
      error: (error) => {
        console.error("Error loading users:", error);
        this.errorMessage = this.getErrorMessage(error);
        this.visibleError = true;
        this.users = [];
        this.filteredUsers = [];
        this.loading = false;
        this.cdr.markForCheck(); // Trigger change detection on error
      },
    });
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return "You don't have permission to view users. Please log in as an administrator.";
    }
    return "Error loading users. Please try again..";
  }

  getDeleteMessage(email: string): SafeHtml {
    const message = `Are you sure you want to delete the user "${email}"?`;
    return this.sanitizer.bypassSecurityTrustHtml(message);
  }

  confirmDelete(email: string): void {
    this.confirmationService.confirm({
      message: this.getDeleteMessage(email) as string,
      header: "Delete User",
      icon: "pi pi-exclamation-triangle",
      acceptButtonStyleClass: "p-button-danger",
      rejectButtonStyleClass: "p-button-secondary",
      acceptIcon: "pi pi-check",
      acceptLabel: "Yes",
      rejectLabel: "No",
      accept: () => {
        this.deleteUser(email);
      },
    });
  }

  deleteUser(email: string): void {
    this.usersService.deleteUser(email).subscribe({
      next: () => {
        this.messageService.add({
          severity: "success",
          summary: "Success",
          detail: "User successfully deleted",
        });
        this.loadUsers();
        this.cdr.markForCheck(); // Trigger change detection after deleting user
      },
      error: (error) => {
        console.error("Error deleting user:", error);
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: "Error deleting user",
        });
        this.cdr.markForCheck(); // Trigger change detection on error
      },
    });
  }

  onSearchChange(): void {
    this.filterUsers(this.searchText);
  }

  private filterUsers(searchText: string): void {
    if (!searchText) {
      this.filteredUsers = [...this.users];
      this.cdr.markForCheck(); // Trigger change detection after filtering
      return;
    }
    const searchTerm = searchText.toLowerCase();
    this.filteredUsers = this.users.filter((user) =>
      user.email.toLowerCase().includes(searchTerm)
    );
    this.cdr.markForCheck(); // Trigger change detection after filtering
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions or resources here
  }
}
