// Just the part of the Admin API client that medium uses
declare module "@tryghost/admin-api"
{
    interface GhostPage
    {
        id: string;
        slug: string;
        title: string;
        status: string;
        updated_at: string;
        [key: string]: unknown;
    }

    interface Resource<T>
    {
        read(data: { id?: string, slug?: string }, queryParams?: object): Promise<T>;
        add(data: Partial<T>, queryParams?: object): Promise<T>;
        edit(data: Partial<T> & { id: string }, queryParams?: object): Promise<T>;
    }

    export default class GhostAdminAPI
    {
        constructor(options: { url: string, key: string, version: string });
        pages: Resource<GhostPage>;
        site: { read(): Promise<{ title: string, url: string, version: string }> };
    }
}
