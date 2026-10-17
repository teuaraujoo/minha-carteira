export interface IUsersRepository {
    getUserById(id: string): Promise<any>
    getUserByEmail(): Promise<any>
    findUserCapabilities(): Promise<any>
    findActiveUser(id: string): Promise<any>
    createUser(): Promise<any>
    cpdateUser(): Promise<any>
    inactiveUser(): Promise<any>
    activeUser(): Promise<any>
    deleteUser(): Promise<any>
    registerUser(): Promise<any>
}