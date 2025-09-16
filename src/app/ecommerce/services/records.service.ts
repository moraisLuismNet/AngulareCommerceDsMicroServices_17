import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, tap, map, catchError, throwError, of, switchMap } from "rxjs";
import { environment } from "src/environments/environment";
import { AuthGuard } from "src/app/guards/auth-guard.service";
import { IRecord } from "../ecommerce.interface";
import { StockService } from "./stock.service";

// Interface that matches the API response
interface RecordItemExtDTO {
  idRecord: number;
  titleRecord: string;
  price: number;
  stock: number;
  discontinued: boolean;
  yearOfPublication?: number | null;
  groupId?: number | null;
  groupName?: string | null;
  musicGenreId?: number | null;
  musicGenreName?: string | null;
  imageRecord?: string | null;
  photo?: string | null;
}

@Injectable({
  providedIn: "root",
})
export class RecordsService {
  private readonly baseUrl = environment.apiUrl.cdService;
  private readonly http = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);
  private readonly stockService = inject(StockService);

  constructor() {}

  getRecords(): Observable<IRecord[]> {
    const headers = this.getHeaders();
    return this.http.get<any>(`${this.baseUrl}records`, { headers }).pipe(
      map((response) => {
        // Handle different response formats
        let records: any[] = [];
        
        if (Array.isArray(response)) {
          // Case 1: Response is already an array
          records = response;
        } else if (response && typeof response === 'object') {
          // Case 2: Response has $values property
          if (Array.isArray(response.$values)) {
            records = response.$values;
          } 
          // Case 3: Response is an object with records as direct properties
          else if (Object.keys(response).length > 0) {
            records = Object.values(response);
          }
        }
        
        // Process records and update stock service
        return records.map(record => {
          const stock = typeof record.stock === 'number' ? record.stock : 0;
          // Update stock in the stock service
          this.stockService.updateStock(record.idRecord, stock);
          
          return {
            ...record,
            stock: stock
          };
        });
      }),
      tap((records) => {
        if (records.length > 0) {
          records.forEach((record) => {
            this.stockService.notifyStockUpdate(record.idRecord, record.stock || 0);
          });
        } else {
          console.log('[RecordsService] No records found');
        }
      }),
      catchError((error) => {
        console.error('[RecordsService] Error getting records:', {
          error,
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message
        });
        return of([]);
      })
    );
  }

  getRecordById(id: number): Observable<IRecord> {
    const headers = this.getHeaders();
    const url = `${this.baseUrl}records/${id}`;
    
    return this.http.get<IRecord>(url, { headers }).pipe(
      switchMap((record: IRecord) => {
        if (record.groupName || record.nameGroup) {
          console.log(`[RecordsService] Record ${id} already has group name:`, {
            groupId: record.groupId,
            groupName: record.groupName,
            nameGroup: record.nameGroup
          });
          return of(record);
        }
        
        // If it doesn't have a group name but it does have a groupId, we search for the group
        if (record.groupId) {
          const groupUrl = `${this.baseUrl}groups/${record.groupId}`;
          return this.http.get<{nameGroup?: string; groupName?: string}>(groupUrl, { headers }).pipe(
            map(groupResponse => {
              const groupName = groupResponse?.nameGroup || groupResponse?.groupName || 'Sin grupo';
              return {
                ...record,
                groupName: groupName,
                nameGroup: groupName
              } as IRecord;
            }),
            catchError(groupError => {
              console.error(`[RecordsService] Error getting group for record ${id}:`, groupError);
              return of({
                ...record,
                groupName: 'Error cargando grupo',
                nameGroup: 'Error cargando grupo'
              } as IRecord);
            })
          );
        }
        
        return of(record);
      }),
      catchError((error: any) => {
        console.error(`[RecordsService] Error getting record with id ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  addRecord(record: IRecord): Observable<IRecord> {
    const headers = this.getHeaders();
    
    if (!record.groupId) {
      throw new Error('Group is required');
    }

    // Create FormData to handle file uploads
    const formData = new FormData();
    formData.append('TitleRecord', record.titleRecord || '');
    formData.append('Price', (record.price || 0).toString());
    formData.append('Stock', (record.stock || 0).toString());
    formData.append('Discontinued', record.discontinued ? 'true' : 'false');
    formData.append('YearOfPublication', record.yearOfPublication?.toString() || '');
    formData.append('GroupId', record.groupId.toString());
    
    // Add the photo file if it exists
    if (record.photo instanceof File) {
      formData.append('Photo', record.photo);
    }
    
    // Remove the Content-Type header to let the browser set it with the correct boundary
    const uploadHeaders = headers.delete('Content-Type');
    
    return this.http
      .post<RecordItemExtDTO>(`${this.baseUrl}records`, formData, {
        headers: uploadHeaders,
        observe: 'response'
      })
      .pipe(
        tap({
          error: (error) => {
            console.error('HTTP Error Response:', {
              status: error.status,
              statusText: error.statusText,
              error: error.error,
              headers: error.headers,
              url: error.url,
              // Try to get more detailed error information
              errorText: error.error?.errors || error.error?.detail || error.message
            });
            
            // Log the complete error object for debugging
            console.error('Complete error object:', error);
            
            // If we have validation errors, log them in a more readable format
            if (error.error?.errors) {
              console.error('Validation errors:');
              Object.entries(error.error.errors).forEach(([key, value]) => {
                console.error(`- ${key}:`, value);
              });
            }
            
            throw error;
          }
        }),
        map((response) => {
          // Map the API response to IRecord
          const apiRecord = response.body;
          if (!apiRecord) {
            throw new Error('No record data received from server');
          }
          return {
            idRecord: apiRecord.idRecord,
            titleRecord: apiRecord.titleRecord,
            yearOfPublication: apiRecord.yearOfPublication || null,
            price: apiRecord.price,
            stock: apiRecord.stock,
            discontinued: apiRecord.discontinued,
            groupId: apiRecord.groupId || null,
            groupName: apiRecord.groupName || '',
            nameGroup: apiRecord.groupName || '',
            imageRecord: apiRecord.imageRecord || null,
            photo: null, // We'll handle file uploads separately if needed
            photoName: apiRecord.photo ? 'photo.jpg' : null
          } as unknown as IRecord;
        }),
        tap({
          next: (newRecord: IRecord) => {
            this.stockService.notifyStockUpdate(
              newRecord.idRecord,
              newRecord.stock
            );
          },
          error: (error) => {
            console.error('Error in addRecord pipeline:', {
              error,
              errorResponse: error?.error,
              status: error?.status,
              statusText: error?.statusText,
              headers: error?.headers,
              url: error?.url
            });
          }
        })
      );
  }

  updateRecord(record: IRecord): Observable<IRecord> {
    const headers = this.getHeaders();
    
    if (!record.groupId) {
      throw new Error('Group is required');
    }

    // Create FormData to handle file uploads
    const formData = new FormData();
    formData.append('IdRecord', record.idRecord.toString());
    formData.append('TitleRecord', record.titleRecord || '');
    formData.append('Price', (record.price || 0).toString());
    formData.append('Stock', (record.stock || 0).toString());
    formData.append('Discontinued', record.discontinued ? 'true' : 'false');
    formData.append('YearOfPublication', record.yearOfPublication?.toString() || '');
    formData.append('GroupId', record.groupId.toString());
    
    // Add the photo file if it exists and is a File object
    if (record.photo instanceof File) {
      formData.append('Photo', record.photo);
    }
    
    // Remove the Content-Type header to let the browser set it with the correct boundary
    const uploadHeaders = headers.delete('Content-Type');
    
    return this.http
      .put<RecordItemExtDTO>(`${this.baseUrl}records/${record.idRecord}`, formData, {
        headers: uploadHeaders,
        observe: 'response'
      })
      .pipe(
        tap({
          error: (error) => {
            console.error('Update Error:', {
              status: error.status,
              statusText: error.statusText,
              error: error.error
            });
          }
        }),
        map((response) => {
          // Map the API response to IRecord
          const apiRecord = response.body;
          if (!apiRecord) {
            throw new Error('No record data received from server');
          }
          return {
            idRecord: apiRecord.idRecord,
            titleRecord: apiRecord.titleRecord,
            yearOfPublication: apiRecord.yearOfPublication || null,
            price: apiRecord.price,
            stock: apiRecord.stock,
            discontinued: apiRecord.discontinued,
            groupId: apiRecord.groupId || null,
            groupName: apiRecord.groupName || '',
            nameGroup: apiRecord.groupName || '',
            imageRecord: apiRecord.imageRecord || null,
            photo: null, // We'll handle file uploads separately if needed
            photoName: apiRecord.photo ? 'photo.jpg' : null
          } as unknown as IRecord;
        }),
        tap((updatedRecord: IRecord) => {
          this.stockService.notifyStockUpdate(
            updatedRecord.idRecord,
            updatedRecord.stock
          );
        })
      );
  }

  deleteRecord(id: number): Observable<IRecord> {
    const headers = this.getHeaders();
    return this.http
      .delete<any>(`${this.baseUrl}records/${id}`, {
        headers,
      })
      .pipe(
        map((response) => {
          const deletedRecord = response.$values || {};
          return deletedRecord;
        })
      );
  }

  getRecordsByGroup(idGroup: string | number): Observable<IRecord[]> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.baseUrl}groups/recordsByGroup/${idGroup}`, { headers })
      .pipe(
        map((response) => {
          let records: IRecord[];
          let groupName = "";
          // Handle direct record array response
          if (Array.isArray(response)) {
            records = response;
          }
          // Handle $values wrapper
          else if (response && response.$values) {
            records = response.$values;
          }
          // Handle records nested in group response
          else if (
            response &&
            typeof response === "object" &&
            response.records
          ) {
            if (Array.isArray(response.records)) {
              records = response.records;
            } else if (response.records.$values) {
              records = response.records.$values;
            } else if (typeof response.records === "object") {
              records = Object.values(response.records).filter(
                (val): val is IRecord => {
                  if (!val || typeof val !== "object") return false;
                  const v = val as any;
                  return (
                    typeof v.idRecord === "number" &&
                    typeof v.titleRecord === "string" &&
                    typeof v.stock === "number"
                  );
                }
              );
            } else {
              records = [];
            }
          }
          // Handle single record response
          else if (
            response &&
            typeof response === "object" &&
            "idRecord" in response
          ) {
            records = [response];
          }
          // Handle other object responses
          else if (response && typeof response === "object") {
            const values = Object.values(response);
            records = values.filter((val): val is IRecord => {
              if (!val || typeof val !== "object") return false;
              const v = val as any;
              return (
                typeof v.idRecord === "number" &&
                typeof v.titleRecord === "string" &&
                typeof v.stock === "number"
              );
            });
          }
          // Default to empty array
          else {
            records = [];
          }

          // If the answer has the group name, save it.
          if (response && response.nameGroup) {
            groupName = response.nameGroup;
          } else if (
            response &&
            typeof response === "object" &&
            response.group &&
            response.group.nameGroup
          ) {
            groupName = response.group.nameGroup;
          }

          // Assign the group name to each record
          records.forEach((record) => {
            record.groupName = groupName || "";
          });

          return records;
        }),
        tap((records) => {
          records.forEach((record) => {
            if (record && record.idRecord && record.stock !== undefined) {
              this.stockService.notifyStockUpdate(
                record.idRecord,
                record.stock
              );
            }
          });
        })
      );
  }

  getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  decrementStock(idRecord: number): Observable<any> {
    const headers = this.getHeaders();
    const amount = -1;
    return this.http
      .put(
        `${this.baseUrl}records/${idRecord}/updateStock/${amount}`,
        {},
        { headers }
      )
      .pipe(
        tap(() => {
          this.stockService.notifyStockUpdate(idRecord, amount);
        }),
        catchError((error) => {
          console.error(`[RecordsService] Error decrementing stock for record ${idRecord}:`, error);
          return throwError(() => error);
        })
      );
  }

  incrementStock(idRecord: number): Observable<any> {
    const headers = this.getHeaders();
    const amount = 1;
    return this.http
      .put(
        `${this.baseUrl}records/${idRecord}/updateStock/${amount}`,
        {},
        { headers }
      )
      .pipe(
        tap(() => {
          this.stockService.notifyStockUpdate(idRecord, amount);
        }),
        catchError((error) => {
          console.error(`[RecordsService] Error incrementing stock for record ${idRecord}:`, error);
          return throwError(() => error);
        })
      );
  }
}
