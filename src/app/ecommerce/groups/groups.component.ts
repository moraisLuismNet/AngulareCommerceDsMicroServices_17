import { Component, ViewChild, ElementRef, ChangeDetectorRef, OnDestroy, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

// Services
import { GroupsService } from '../services/groups.service';
import { GenresService } from '../services/genres.service';

// Interfaces
import { IGroup } from '../ecommerce.interface';

@Component({
  selector: 'app-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    InputTextModule,
    DialogModule,
    ConfirmDialogModule,
    TooltipModule
  ],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.css'],
  providers: [ConfirmationService],
})
export class GroupsComponent implements OnInit, OnDestroy {
  @ViewChild('form') form!: NgForm;
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('groupsTable') groupsTable!: ElementRef<HTMLTableElement>;
  private genresLoaded = false;
  private pendingEditGroup: IGroup | null = null;
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
  private cdr = inject(ChangeDetectorRef);
  private groupsService = inject(GroupsService);
  private genresService = inject(GenresService);
  private confirmationService = inject(ConfirmationService);
  
  constructor() {}

  ngOnInit(): void {
    this.getGroups();
    this.getGenres().then(() => {
    }).catch(err => {
      console.error('Failed to load genres:', err);
    });
  }

  getGroups() {
    this.groupsService.getGroups().subscribe({
      next: (data: any) => {
        // Directly assign the response array (without using .$values)
        this.groups = Array.isArray(data) ? data : [];
        this.filteredGroups = [...this.groups];
        this.cdr.markForCheck(); // Trigger change detection
      },
      error: (err) => {
        console.error('Error fetching groups:', err);
        this.visibleError = true;
        this.errorMessage = 'Failed to load groups. Please try again.';
        this.cdr.markForCheck(); // Trigger change detection
      },
    });
  }

  getGenres() {
    return new Promise<void>((resolve, reject) => {
      this.genresService.getGenres().subscribe({
        next: (data: any) => {
          this.cdr.markForCheck(); // Trigger change detection
          // Handle different response formats
          let genresArray = [];
          if (Array.isArray(data)) {
            genresArray = data;
          } else if (data && Array.isArray(data.$values)) {
            genresArray = data.$values;
          } else if (data && data.data && Array.isArray(data.data)) {
            genresArray = data.data;
          }
          
          this.genres = genresArray;
          this.genresLoaded = true;
          
          // If there was a pending edit, process it now
          if (this.pendingEditGroup) {
            this.processEdit(this.pendingEditGroup);
            this.pendingEditGroup = null;
          }
          
          this.cdr.detectChanges();
          resolve();
        },
        error: (err) => {
          console.error('Error loading genres:', err);
          this.visibleError = true;
          this.errorMessage = 'Failed to load music genres. Please try again.';
          this.controlError(err);
          reject(err);
        },
      });
    });
  }

  filterGroups() {
    if (!this.searchText.trim()) {
      this.filteredGroups = [...this.groups];
    } else {
      const searchTerm = this.searchText.toLowerCase().trim();
      this.filteredGroups = this.groups.filter(group => 
        group.nameGroup?.toLowerCase().includes(searchTerm) ||
        group.musicGenreName?.toLowerCase().includes(searchTerm)
      );
    }
    this.cdr.markForCheck(); // Trigger change detection after filtering
  }

  onSearchChange() {
    this.filterGroups();
  }

  // Clean up any subscriptions or resources here

  save() {
    if (this.group.idGroup === 0) {
      this.groupsService.addGroup(this.group).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.form.reset();
          this.getGroups();
          this.cdr.markForCheck(); // Trigger change detection
        },
        error: (err) => {
          console.log(err);
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck(); // Trigger change detection
        },
      });
    } else {
      this.groupsService.updateGroup(this.group).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.reset();
          this.getGroups();
        },
        error: (err) => {
          this.visibleError = true;
          this.controlError(err);
        },
      });
    }
  }

  async edit(group: IGroup) {
    // If genres aren't loaded yet, store the group and wait for them to load
    if (!this.genresLoaded) {
      this.pendingEditGroup = group;
      try {
        await this.getGenres();
      } catch (error) {
        console.error('Error loading genres:', error);
      }
      return;
    }
    
    this.processEdit(group);
  }
  
  private processEdit(group: IGroup) {
    // Create a deep copy of the group to avoid reference issues
    this.group = { ...group };
    
    // Set the photo name if image exists
    this.group.photoName = group.imageGroup
      ? this.extractNameImage(group.imageGroup)
      : '';
    
    // Make sure musicGenreId is set to the correct value
    if (group.musicGenreId && this.genres.length > 0) {
      // Verify the genre exists in our list
      const foundGenre = this.genres.find(g => g.idMusicGenre === group.musicGenreId);
      if (foundGenre) {
        this.group.musicGenreId = foundGenre.idMusicGenre;
        this.group.musicGenreName = foundGenre.nameMusicGenre;
      } else {
        // Try to find by name if ID doesn't match
        this.tryFindGenreByName(group);
      }
    } else if (this.genres.length === 0) {
      // If no genres are loaded, try to reload them
      this.getGenres().then(() => {
        this.processEdit(group);
      });
      return;
    } else {
      // Try to find by name if no ID is provided
      this.tryFindGenreByName(group);
    }

    // Force change detection to update the view
    this.cdr.detectChanges();
  }
  
  private tryFindGenreByName(group: IGroup) {
    if (group.musicGenreName) {
      const foundGenre = this.genres.find(g => 
        g.nameMusicGenre?.toLowerCase() === group.musicGenreName?.toLowerCase()
      );
      
      if (foundGenre) {
        this.group.musicGenreId = foundGenre.idMusicGenre;
        this.group.musicGenreName = foundGenre.nameMusicGenre;
      } else {
        console.warn(`Genre with name '${group.musicGenreName}' not found`);
      }
    }
  }

  extractNameImage(url: string): string {
    return url.split('/').pop() || '';
  }

  cancelEdition() {
    this.group = {
      idGroup: 0,
      nameGroup: '',
      imageGroup: null,
      photo: null,
      musicGenreId: 0,
      musicGenreName: '',
      musicGenre: '',
    };
  }

  controlError(err: any) {
    if (err.error && typeof err.error === 'object' && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === 'string') {
      this.errorMessage = err.error;
    } else {
      this.errorMessage = 'An unexpected error has occurred';
    }
    this.cdr.markForCheck();
  }

  deleteGroup(id: number) {
    this.groupsService.deleteGroup(id).subscribe({
      next: (data) => {
        this.visibleError = false;
        this.form.reset();
        this.getGroups();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error deleting group:', err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }

  confirmDelete(group: IGroup) {
    this.confirmationService.confirm({
      message: `Delete the group ${group.nameGroup}?`,
      header: 'Are you sure?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteGroup(group.idGroup!),
    });
  }

  onChange(event: any) {
    const file = event.target?.files?.[0];
    if (file) {
      this.group.photo = file;
      this.group.photoName = file.name;
      this.cdr.markForCheck();
    }
  }

  showImage(group: IGroup) {
    if (this.visiblePhoto && this.group === group) {
      this.visiblePhoto = false;
    } else {
      this.group = group;
      this.photo = group.imageGroup!;
      this.visiblePhoto = true;
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions or resources here
  }
}
