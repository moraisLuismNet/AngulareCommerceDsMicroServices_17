export interface IGenre {
  idMusicGenre?: number;
  nameMusicGenre: string;
  totalGroups?: number;
}

export interface IGroup {
  idGroup: number;
  nameGroup: string;
  imageGroup: string | null;
  photo?: File | null;
  photoName?: string | null;
  totalRecords?: number;
  musicGenreId: number;
  musicGenreName: string;
  musicGenre: string;
}

export interface IRecord {
  idRecord: number;
  titleRecord: string;
  yearOfPublication: number | null;
  price: number;
  stock: number;
  discontinued: boolean;
  groupId: number | null;
  groupName: string;
  nameGroup: string;
  inCart?: boolean;
  amount?: number;
  imageRecord: string | null;
  photo: File | null;
  photoName: string | null;
}

export interface ICartDetail {
  // Core cart detail properties
  idCartDetail: number;
  recordId: number;
  amount: number;
  cartId: number;
  
  // Display properties
  recordTitle: string;  // For backward compatibility
  titleRecord: string;
  groupName: string;
  imageRecord: string | null;
  price: number;
  total: number;
  stock: number;
  
  // Optional properties
  record?: IRecord;
}

export interface ICart {
  cartDetails?: any;
  idCart: number;
  userEmail: string;
  totalPrice: number;
  enabled?: boolean;
}

export interface IOrder {
  idOrder: number;
  orderDate: string;
  paymentMethod: string;
  total: number;
  userEmail: string;
  cartId: number;
  orderDetails: IOrderDetail[];
}

export interface IOrderDetail {
  idOrderDetail: number;
  orderId: number;
  recordId: number;
  recordTitle?: string;
  amount: number;
  price: number;
  total: number;
}

export interface IUser {
  email: string;
  role: string;
}
