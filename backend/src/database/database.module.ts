import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from 'src/chat/channel/channel.entity';
import { Connection } from 'src/chat/connection/connection.entity';
import { Message } from 'src/chat/message/message.entity';
import User from 'src/users/user.entity';
import { PunishedUser } from "src/chat//punisheduser/punisheduser.entity";
import {Match} from '../pong/match/match.entity'

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('POSTGRES_HOST'),
                port: configService.get('POSTGRES_PORT'),
                username: configService.get('POSTGRES_USER'),
                password: configService.get('POSTGRES_PASSWORD'),
                database: configService.get('POSTGRES_DB'),
                entities: [User, Channel, Message, Connection, PunishedUser, Match],
                synchronize: true,
            })
        })
    ],
})
export class DatabaseModule {}
