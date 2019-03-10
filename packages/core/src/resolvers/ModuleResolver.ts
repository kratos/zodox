import { Type, Reflector } from "@zodox/common";
import { BaseResolver, META_RESOLVERS } from "./BaseResolver";
import { Module, Inject, Optional, Injectable } from "../annotations";
import { ModuleMetadata, TypeMetadata } from "../metadata";
import { NoAnnotationError } from "../errors";

@Injectable()
export class ModuleResolver {
    private cache = new Map<Type<any>, any>();

    constructor(@Inject(META_RESOLVERS) @Optional() private resolvers: BaseResolver<any>[] = []) {}

    isSupported(type: Type<any>): boolean {
        return Reflector.hasAnnotation(type, Module);
    }
    
    resolve(type: Type<any>): ModuleMetadata {
        if(this.cache.has(type)) {
            return this.cache.get(type)!;
        }

        const annotation = Reflector.getAnnotation(type, Module);
        if(!annotation) {
            throw new NoAnnotationError(type, 'Module');
        }

        const metadata: ModuleMetadata = {
            type,
            providers: [],
            declarations: [],
            importedModules: [],
            exportedModules: []
        }

        if(annotation.imports) {
            annotation.imports.forEach(importedType => {
                let importedModule: Type<any> = undefined !;
                if (importedType instanceof Function) /* Type */{
                    importedModule = importedType;
                } else if (importedType && importedType.module) {
                    // const moduleWithProviders: ModuleWithProviders = importedType;
                    importedModule = importedType.module;
                    if (importedType.providers) {
                        metadata.providers.push(...importedType.providers);
                    }
                }

                if(importedModule == type) {
                    return;
                }

                if(!this.isSupported(importedModule)) {
                    throw new NoAnnotationError(importedModule, 'Module');
                }

                const moduleMeta = this.resolve(importedModule);
                metadata.importedModules.push(moduleMeta);

                //metadata.importedModules = [...metadata.importedModules, ...moduleMeta.importedModules];
                //moduleMeta.importedModules.forEach(type => metadata.importedModules.push(type));

                // TODO: Check whether this module was already included earlier
                //const summary = this.getModuleSummary(importedModule);

                //summary.modules.forEach(mod => metadata.addModule(mod));
                //summary.controllers.forEach(controller => metadata.addController(controller));
                // summary.providers.forEach((providers, modType) => {
                //     // TODO: Do some provider checkin...

                //     providers.forEach(provider => metadata.addProvider(modType, provider));
                // });
                //summary.providers.forEach(provider => metadata.addProvider(provider));
            });
        }

        if(annotation.exports) {
            annotation.exports.forEach(exportedModule => {
                if(!this.isSupported(exportedModule)) {
                    throw new NoAnnotationError(exportedModule, 'Module');
                }

                const moduleMeta = this.resolve(exportedModule);
                metadata.importedModules.push(moduleMeta);
            });
        }

        if(annotation.declarations) {
            annotation.declarations.forEach(declaration => {
                metadata.declarations.push(this.resolveDeclaration(declaration));
            });
        }

        // if(annotation.controllers) {
        //     annotation.controllers.forEach(controller => {
        //         if(!this.isController(controller)) {
        //             throw new NoAnnotationError(controller, AnnotationDescriptor.CONTROLLER);
        //         }

        //         metadata.addController(controller);
        //     })
        // }

        if(annotation.providers) {
            metadata.providers.push(...annotation.providers);
        }

        //metadata.addModule(type);

        this.cache.set(type, metadata);

        return metadata;
    }

    private resolveDeclaration<T extends TypeMetadata>(type: Type<any>): T {
        const resolver = this.resolvers.find(r => r.isSupported(type));

        if(!resolver) {
            throw new Error(`Failed to resolve metadata of ${type.name}, did you add it's resolver to the 'META_RESOLVERS' multi provider.`);
        }

        return resolver.resolve(type) as T;
    }
}