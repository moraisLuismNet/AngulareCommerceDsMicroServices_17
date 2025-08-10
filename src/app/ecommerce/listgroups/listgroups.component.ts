import { Component, ViewChild, ElementRef, OnDestroy, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

// Modules
import { SharedModule } from '../../shared/shared.module';

// Services
import { GroupsService } from '../services/groups.service';
import { GenresService } from '../services/genres.service';

// Interfaces
import { IGroup } from '../ecommerce.interface';

@Component({
  selector: 'app-listgroups',
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
  templateUrl: './listgroups.component.html',
  styleUrls: ['./listgroups.component.css'],
  providers: [ConfirmationService],
})
export class ListgroupsComponent implements OnInit, OnDestroy {
  @ViewChild('navbar', { static: false }) navbar: any; // Using 'any' type to avoid circular dependency
  @ViewChild('form') form!: NgForm;
  @ViewChild('fileInput') fileInput!: ElementRef;
  visibleError = false;
  errorMessage = '';
  groups: IGroup[] = [];
  filteredGroups: IGroup[] = [];
  visibleConfirm = false;
  imageGroup = '';
  visiblePhoto = false;
  photo = '';
  searchText: string = '';

  group: IGroup = {
    idGroup: 0,
    nameGroup: '',
    imageGroup: null,
    photo: null,
    musicGenreId: 0,
    musicGenreName: '',
    musicGenre: '',
  };

  genres: any[] = [];
  records: any[] = [];

  private groupsService = inject(GroupsService);
  private genresService = inject(GenresService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);


  ngOnInit(): void {
    this.getGroups();
    this.getGenres();
  }

  getGroups() {
    this.groupsService.getGroups().subscribe({
      next: (data: any) => {
        this.visibleError = false;

        // Handle different possible response formats
        if (Array.isArray(data)) {
          this.groups = data;
        } else if (data && typeof data === 'object') {
          // Check for $values property safely
          if (data.hasOwnProperty('$values')) {
            this.groups = Array.isArray(data.$values) ? data.$values : [];
          } else if (data.hasOwnProperty('data')) {
            this.groups = Array.isArray(data.data) ? data.data : [];
          } else {
            // If it's an object but not in the expected format, try to convert it to an array
            this.groups = Object.values(data);
          }
        } else {
          this.groups = [];
          console.warn('Unexpected data format:', data);
        }

        this.filterGroups();
        this.cdr.markForCheck(); // Trigger change detection after loading groups
      },
      error: (err: any) => {
        console.error('Error loading groups:', err);
        this.visibleError = true;
        this.controlError(err);
        this.groups = [];
        this.filteredGroups = [];
        this.cdr.markForCheck(); // Trigger change detection on error
      },
    });
  }

  getGenres() {
    this.genresService.getGenres().subscribe({
      next: (data) => {
        this.genres = data;
        this.cdr.markForCheck(); // Trigger change detection after loading genres
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  controlError(err: any) {
    if (err.error && typeof err.error === 'object' && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === 'string') {
      this.errorMessage = err.error;
    } else {
      this.errorMessage = 'An unexpected error has occurred';
    }
  }

  filterGroups() {
    if (!Array.isArray(this.groups)) {
      console.warn('Groups is not an array:', this.groups);
      this.groups = [];
      this.filteredGroups = [];
      return;
    }

    try {
      const searchText = this.searchText ? this.searchText.toLowerCase() : '';
      this.filteredGroups = this.groups.filter((group) => {
        const groupName = group.nameGroup ? group.nameGroup.toLowerCase() : '';
        return groupName.includes(searchText);
      });
      this.cdr.markForCheck(); // Trigger change detection after filtering
      
    } catch (error) {
      console.error('Error filtering groups:', error);
      this.filteredGroups = [];
    }
  }

  onSearchChange() {
    this.filterGroups();
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions or resources here
  }

  showImage(group: IGroup) {
    if (this.visiblePhoto && this.group === group) {
      this.visiblePhoto = false;
    } else {
      this.group = group;
      this.photo = group.imageGroup!;
      this.visiblePhoto = true;
    }
  }

  loadRecords(idGroup: string): void {
    this.router.navigate(['/listrecords', idGroup]);
  }
}
