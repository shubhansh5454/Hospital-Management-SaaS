import { prisma } from '../../db/prisma.ts';

export class FileRepository {
  /**
   * Create a file or folder record
   */
  public static async create(data: {
    name: string;
    isFolder: boolean;
    parentId?: number | null;
    fileType?: string | null;
    mimeType?: string | null;
    size?: number | null;
    content?: string | null;
    patientId?: number | null;
    clinicId?: number | null;
    uploadedById?: number | null;
    accessRoles?: string | null;
  }) {
    return prisma.clinicFile.create({
      data: {
        name: data.name,
        isFolder: data.isFolder,
        parentId: data.parentId || null,
        fileType: data.fileType || null,
        mimeType: data.mimeType || null,
        size: data.size || null,
        content: data.content || null,
        patientId: data.patientId || null,
        clinicId: data.clinicId || null,
        uploadedById: data.uploadedById || null,
        accessRoles: data.accessRoles || null,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
  }

  /**
   * Find a file/folder by ID
   */
  public static async findById(id: number) {
    return prisma.clinicFile.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
          }
        },
        children: true,
      }
    });
  }

  /**
   * Find all files/folders in a clinic, optionally filtered by folder or query
   */
  public static async findAll(clinicId: number, parentId: number | null = null, search?: string) {
    const whereClause: any = {
      clinicId,
    };

    if (search) {
      // If searching, search recursively across all directories
      whereClause.name = {
        contains: search,
        mode: 'insensitive',
      };
    } else {
      // Otherwise, filter by parent folder to maintain hierarchical browse
      whereClause.parentId = parentId;
    }

    return prisma.clinicFile.findMany({
      where: whereClause,
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: [
        { isFolder: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Delete a file or folder (cascading delete is handled automatically by PostgreSQL foreign keys)
   */
  public static async delete(id: number) {
    return prisma.clinicFile.delete({
      where: { id },
    });
  }
}
