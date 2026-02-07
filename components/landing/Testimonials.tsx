'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
// import { Avatar } from '@/components/ui/Avatar'; // We don't have Avatar component yet, I will simulate it

const testimonials = [
    {
        name: "Alex Rivera",
        role: "E-commerce Manager",
        content: "The speed at which we can now list products is insane. Umari Studio reduced our workflow from days to minutes.",
        image: "https://placehold.co/100x100/png?text=AR"
    },
    {
        name: "Sarah Chen",
        role: "Brand Director",
        content: "The quality of the AI-generated images is indistinguishable from our studio shoots. Truly impressed.",
        image: "https://placehold.co/100x100/png?text=SC"
    },
    {
        name: "Michael Ross",
        role: "Agency Owner",
        content: "Managing multiple client brands was a nightmare before. Now we have a consistent style for each one automatically.",
        image: "https://placehold.co/100x100/png?text=MR"
    }
];

export function Testimonials() {
    return (
        <section className="py-20 lg:py-32 overflow-hidden bg-white">
            <Container>
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <Badge variant="violet" className="mb-4">Testimonials</Badge>
                    <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-slate-900">
                        Trusted by creators
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="flex flex-col p-8 rounded-3xl bg-slate-50 border border-slate-100"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-12 w-12 rounded-full bg-slate-200 overflow-hidden">
                                    {/* Placeholder for Avatar */}
                                    <img src={testimonial.image} alt={testimonial.name} className="h-full w-full object-cover" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900">{testimonial.name}</h4>
                                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                                </div>
                            </div>
                            <p className="text-slate-600 italic">"{testimonial.content}"</p>
                        </motion.div>
                    ))}
                </div>
            </Container>
        </section>
    );
}
