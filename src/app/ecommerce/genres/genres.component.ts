import { Component, ViewChild, OnDestroy, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

// Services
import { GenresService } from '../services/genres.service';

// Interfaces
import { IGenre } from '../ecommerce.interface';

@Component({
  selector: 'app-genres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    InputTextModule,
    DialogModule,
    ConfirmDialogModule
  ],
  templateUrl: './genres.component.html',
  styleUrls: ['./genres.component.css'],
  providers: [ConfirmationService],
})
export class GenresComponent implements OnInit, OnDestroy {
  @ViewChild('form') form!: NgForm;
  
  private genresService = inject(GenresService);
  private confirmationService = inject(ConfirmationService);
  private cdr = inject(ChangeDetectorRef);
  
  constructor() {}

  ngOnInit(): void {
    this.getGenres();
  }
  visibleError = false;
  errorMessage = '';
  genres: IGenre[] = [];
  filteredGenres: IGenre[] = [];
  visibleConfirm = false;
  searchTerm: string = '';

  genre: IGenre = {
    idMusicGenre: 0,
    nameMusicGenre: '',
  };

  // Initialization moved to afterNextRender in constructor

  getGenres() {
    this.genresService.getGenres().subscribe({
      next: (data: any) => {
        this.visibleError = false;
        
        // Check if data is an array or has a $values property
        if (Array.isArray(data)) {
          this.genres = data;
        } else if (data && Array.isArray(data.$values)) {
          // Handle case where data is an object with $values array
          this.genres = data.$values;
        } else {
          console.warn('Unexpected data format:', data);
          this.genres = [];
        }
        
        this.filteredGenres = [...this.genres];
        this.cdr.markForCheck(); // Trigger change detection
      },
      error: (err) => {
        console.error('Error:', err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck(); // Trigger change detection
      },
    });
  }
  save() {
    if (this.genre.idMusicGenre === 0) {
      this.genresService.addGenre(this.genre).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.form.reset();
          this.getGenres();
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
      this.genresService.updateGenre(this.genre).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.genre = { idMusicGenre: 0, nameMusicGenre: '' };
          this.form.reset();
          this.getGenres();
          this.cdr.markForCheck(); // Trigger change detection
        },
        error: (err) => {
          console.log(err);
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck(); // Trigger change detection
        },
      });
    }
  }

  edit(genre: IGenre) {
    this.genre = { ...genre };
  }

  cancelEdition() {
    this.genre = {
      idMusicGenre: 0,
      nameMusicGenre: '',
    };
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions or resources here
  }

  confirmDelete(genre: IGenre) {
    this.confirmationService.confirm({
      message: `Delete the genre ${genre.nameMusicGenre}?`,
      header: 'Are you sure?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteGenre(genre.idMusicGenre!),
    });
  }

  deleteGenre(id: number) {
    this.genresService.deleteGenre(id).subscribe({
      next: (data) => {
        this.visibleError = false;
        this.getGenres();
        this.cdr.markForCheck(); // Trigger change detection
      },
      error: (err) => {
        console.log(err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck(); // Trigger change detection
      },
    });
  }

  filterGenres() {
    const term = this.searchTerm.toLowerCase();
    this.filteredGenres = this.genres.filter((genre) =>
      genre.nameMusicGenre.toLowerCase().includes(term)
    );
  }
  controlError(err: any) {
    if (err.error && typeof err.error === 'object' && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === 'string') {
      // If `err.error` is a string, it is assumed to be the error message
      this.errorMessage = err.error;
    } else {
      // Handles the case where no useful error message is received
      this.errorMessage = 'An unexpected error has occurred';
    }
  }
}
