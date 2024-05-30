import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Property } from './entities/property.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FindAllPropertiesDto } from './dto/findall-property.dto';
import { Photo } from './entities/photo.entity';
import { Client } from 'minio';
import { FindOnePropertyDto } from './dto/findone-property.dto';

@Injectable()
export class PropertiesService {
  @InjectRepository(Property)
  private propertiesRepository: Repository<Property>;

  @InjectRepository(Photo)
  private photosRepository: Repository<Photo>;

  create(createPropertyDto: CreatePropertyDto) {
    return 'WIP';
  }

  async getPhotoFilenameFromId(id: number) {
    let photo = await this.photosRepository.findOneBy({id:id});

    if (photo) {
      return photo.path;
    } else {
      return null;
    }
  }

  async getDynamicPhotoUrlFromFilename(filename: string) {
    let minioClient = new Client({
      endPoint: 'minio.taffin.ovh',
      port: 443,
      useSSL: true,
      accessKey: 'mODvNLwCYcqJXNf4Lci1',
      secretKey: '3YXQium7Hrmyqz1zS694t6gF4wgbe6ufO7DLABuf',
    });

    let url = await minioClient.presignedGetObject('immotep-files', filename, 60*60);
    return url;
  
    // return `https://minio.taffin.ovh/immotep-files/${filename}`;
  } 

  async findAll() {
    let properties = await this.propertiesRepository.find({ relations: ['owner', 'propertyType', 'contracts', 'contracts.owner', 'contracts.renter', 'contracts.inventories'] });
    let returnArray = [];
    for (let property of properties) {
      let photosUrls = [];

      for (let photoId of property.photos) {
        let photoFilename = await this.getPhotoFilenameFromId(parseInt(photoId));
        let photoUrl = await this.getDynamicPhotoUrlFromFilename(photoFilename);
        photosUrls.push(photoUrl);
      }
         
      let property_obj = new FindAllPropertiesDto();
      property_obj.id = property.id;
      property_obj.nomProprietaire = property.owner.lastname;
      property_obj.prenomProprietaire = property.owner.firstname;
      property_obj.typeBien = property.propertyType.lib;
      property_obj.photos = photosUrls;
      property_obj.pourcentageAvancement = property.contracts.at(-1).inventories.at(-1).progress;
      returnArray.push(property_obj);
    }
    return returnArray;
  }

  async findOne(id: number) {
    let property = await this.propertiesRepository.findOne({
      where: {id: id},
      relations: ['propertyType', 'contracts', 'contracts.owner', 'contracts.renter', 'contracts.inventories', 'city', 'rooms'],
    });

    let contracts = [];
    for (let contract of property.contracts) {
      contracts.push({
        beginDate: contract.beginDate,
        endDate: contract.endDate,
        ownerLastName: contract.owner.lastname,
        ownerFirstName: contract.owner.firstname,
      });
    }

    let photos = [];
    for (let photo of property.photos) {
      let photoFilename = await this.getPhotoFilenameFromId(parseInt(photo));
      let photoUrl = await this.getDynamicPhotoUrlFromFilename(photoFilename);
      photos.push(photoUrl);
    }

    // TODO: Ajouter les photos + nombre de pièces
    let propertyDto = new FindOnePropertyDto();
    propertyDto.id = property.id;
    propertyDto.propertyType = property.propertyType.lib;
    propertyDto.city = property.city.name;
    propertyDto.postalCode = property.city.postalCode;
    propertyDto.progress = property.contracts.at(-1).inventories.at(-1).progress;
    propertyDto.inventoryId = property.contracts.at(-1).inventories.at(-1).id;
    propertyDto.isStartingInventory = property.contracts.at(-1).inventories.at(-1).isStartingInventory;
    propertyDto.contractId = property.contracts.at(-1).id;
    propertyDto.numberOfRooms = property.rooms.length;
    propertyDto.streetNumber = property.streetNumber;
    propertyDto.streetName = property.streetName;
    propertyDto.floor = property.floor;
    propertyDto.flatNumber = property.flatNumber;
    propertyDto.longitude = property.longitude;
    propertyDto.latitude = property.latitude;
    propertyDto.description = property.description;
    propertyDto.contracts = contracts;
    propertyDto.photos = photos;
    return propertyDto;
  }

}
